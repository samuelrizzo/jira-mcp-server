import axios, { AxiosError } from 'axios';
import * as yup from 'yup';
import { JiraUpdateIssueRequestSchema } from '../validators/index.js';
import { createAuthHeader, validateCredentials } from '../utils/auth.js';
import { toADF } from '../utils/adfUtils.js';
import { ADFContent, JiraUpdateIssuePayload, JiraTransitionPayload, User, Issue } from '../jira-api-types.js';
import { KnownError, CredentialsError } from '../types/index.js';
import { isAxiosErr } from '../utils/index.js';
import { AxiosStatic } from 'axios'; // For axiosInstance type
import { Transition } from '../jira-api-types.js'; // Ensure this is imported

// Helper Function Implementations will start here
// Note: For brevity, the helper functions defined in the previous step are assumed to be below this main function.
// The actual helper functions are already part of the file from the previous step.

/**
 * Describes the `jira_update_issue` tool for updating existing Jira issues.
 * This tool allows modification of various fields such as summary, description,
 * assignee, and status.
 */
export const updateIssueToolDescription = {
  name: "jira_update_issue",
  description: "Updates an existing issue in Jira. Allows modification of summary, description, assignee, and status.",
  inputSchema: {
    type: "object",
    properties: {
      jiraHost: {
        type: "string",
        description: "The Jira host URL (e.g., 'your-domain.atlassian.net'). Optional, defaults to JIRA_HOST env var.",
      },
      email: {
        type: "string",
        description: "The email address of the user performing the update. Optional, defaults to JIRA_EMAIL env var.",
      },
      apiToken: {
        type: "string",
        description: "The API token for Jira authentication. Optional, defaults to JIRA_API_TOKEN env var.",
      },
      issueIdOrKey: {
        type: "string",
        description: "The ID or key of the Jira issue to be updated (e.g., 'PROJECT-123' or '10001'). Required.",
      },
      summary: {
        type: "string",
        description: "The new summary for the Jira issue. Optional.",
      },
      description: {
        type: "string", // Can also be an ADF object, but schema input describes it as string for simplicity to the LLM
        description: "The new description for the Jira issue. Can be a plain string or an Atlassian Document Format (ADF) object. Optional.",
      },
      status: {
        type: "string",
        description: "The name of the status to transition the issue to (e.g., 'In Progress', 'Done'). Optional.",
      },
      assigneeName: {
        type: "string",
        description: "The display name or account ID of the user to assign the issue to. Optional.",
      },
    },
    required: ["issueIdOrKey"],
  },
};

/**
 * Updates an existing Jira issue based on the provided arguments.
 * It can update fields like summary, description, assignee, and status.
 *
 * @param args - The arguments for updating the issue, conforming to JiraUpdateIssueRequestSchema.
 * @returns A promise that resolves to an object containing the response message or an error.
 */
export async function updateIssue(args: yup.InferType<typeof JiraUpdateIssueRequestSchema>): Promise<{ content: any[]; isError: boolean; }> {
    let updatedFieldsMessages: string[] = []; // To track what was changed
    let jiraHostForErrorContext: string | undefined; // For error context
    let issueIdOrKeyForErrorContext: string | undefined; // For error context

    try {
        // 1. Validate input arguments
        const validatedArgs = await JiraUpdateIssueRequestSchema.validate(args, { abortEarly: false, stripUnknown: true });
        issueIdOrKeyForErrorContext = validatedArgs.issueIdOrKey; // Capture for error context

        // 2. Get Credentials
        const { jiraHost, authHeader } = getJiraCredentials(validatedArgs, process.env);
        jiraHostForErrorContext = jiraHost; // Capture for error context

        // 3. Initialize fieldsToUpdate payload
        let fieldsToUpdate: JiraUpdateIssuePayloadFields;
        let assigneeAccountId: string | undefined;

        // 4. Handle Assignee Update
        if (validatedArgs.assigneeName) {
            try {
                const assignee = await searchJiraUser(axios, jiraHost, authHeader, validatedArgs.assigneeName);
                if (assignee) {
                    assigneeAccountId = assignee.accountId;
                    // Message will be added after successful field update
                } else {
                    updatedFieldsMessages.push(`- ⚠️ Warning: Assignee '${validatedArgs.assigneeName}' not found or not active. Assignee not changed.`);
                }
            } catch (searchError) {
                // Log or handle user search error specifically if needed, then add warning
                const searchErrorMessage = isAxiosErr(searchError) ? searchError.message : (searchError instanceof Error ? searchError.message : "Unknown error during assignee search");
                updatedFieldsMessages.push(`- ⚠️ Warning: Error searching for assignee '${validatedArgs.assigneeName}': ${searchErrorMessage}. Assignee not changed.`);
            }
        }

        // 5. Build Fields Payload
        fieldsToUpdate = buildJiraUpdateFieldsPayload(
            {
                summary: validatedArgs.summary,
                description: validatedArgs.description,
                assigneeAccountId: assigneeAccountId, // Only pass if assignee was found
            },
            toADF // Pass the toADF function as the adfConverter
        );

        // 6. Update Issue Fields via API
        if (Object.keys(fieldsToUpdate).length > 0) {
            await updateJiraIssueFields(axios, jiraHost, authHeader, validatedArgs.issueIdOrKey, fieldsToUpdate);
            if (fieldsToUpdate.summary !== undefined) updatedFieldsMessages.push("- Summary updated");
            if (fieldsToUpdate.description !== undefined) updatedFieldsMessages.push("- Description updated");
            if (fieldsToUpdate.assignee !== undefined) updatedFieldsMessages.push(`- Assignee updated`); // Generic message, specific name was in warning or not applicable
        }

        // 7. Handle Status Transition
        if (validatedArgs.status) {
            try {
                const transitions = await getJiraIssueTransitions(axios, jiraHost, authHeader, validatedArgs.issueIdOrKey);
                const targetTransition = findTargetTransition(transitions, validatedArgs.status);

                if (targetTransition) {
                    await postJiraIssueTransition(axios, jiraHost, authHeader, validatedArgs.issueIdOrKey, targetTransition.id);
                    updatedFieldsMessages.push(`- Status changed to "${targetTransition.to.name}"`);
                } else {
                    const availableTransitions = transitions.map(t => t.to.name).join(', ') || "None available";
                    updatedFieldsMessages.push(`- ⚠️ Warning: Status transition to "${validatedArgs.status}" not available. Available transitions: ${availableTransitions}.`);
                }
            } catch (transitionError) {
                 const transitionErrorMessage = isAxiosErr(transitionError) ? transitionError.message : (transitionError instanceof Error ? transitionError.message : "Unknown error during status transition");
                 updatedFieldsMessages.push(`- ⚠️ Warning: Error during status transition: ${transitionErrorMessage}.`);
            }
        }
        
        // 8. Check if any action was performed or attempted
        // If no fields were to be updated AND no status was provided AND no assignee search was attempted (which would produce a message)
        if (Object.keys(fieldsToUpdate).length === 0 && !validatedArgs.status && !validatedArgs.assigneeName) {
             return {
                content: [{ type: "text", text: "No update parameters provided. No changes made to the issue." }],
                isError: false, 
            };
        }
        // If messages array is empty at this point, it means only assigneeName was provided but not found, and no other changes.
        if (updatedFieldsMessages.length === 0 && validatedArgs.assigneeName && Object.keys(fieldsToUpdate).length === 0 && !validatedArgs.status){
             updatedFieldsMessages.push(`- ⚠️ Warning: Assignee '${validatedArgs.assigneeName}' not found or not active. No other updates performed.`);
        }


        // 9. Fetch Updated Issue Details
        const updatedIssue = await fetchJiraIssueDetails(axios, jiraHost, authHeader, validatedArgs.issueIdOrKey);

        // 10. Format Success Response
        const successMessage = formatSuccessResponseMessage(updatedIssue, updatedFieldsMessages, jiraHost);
        return {
            content: [{ type: "text", text: successMessage }],
            isError: false,
        };

    } catch (error: unknown) {
        // 11. Format Error Response
        // Use the captured context or fallback to args/env
        const finalIssueIdOrKey = issueIdOrKeyForErrorContext || (typeof args.issueIdOrKey === 'string' ? args.issueIdOrKey : "N/A");
        const finalJiraHost = jiraHostForErrorContext || (typeof args.jiraHost === 'string' && args.jiraHost) || process.env.JIRA_HOST || "N/A";
        
        return mapErrorToResponseFormat(
            error,
            yup, 
            isAxiosErr, 
            CredentialsError, 
            finalIssueIdOrKey,
            finalJiraHost
        );
    }
}

// --- Helper Functions --- 
// (These functions were defined in the previous step and are part of this file)

/**
 * Extracts Jira credentials from arguments or environment variables, validates them,
 * and returns them along with an authentication header.
 * @param args - The validated arguments from the JiraUpdateIssueRequestSchema.
 * @param env - The Node.js process environment.
 * @returns An object containing jiraHost, email, apiToken, and authHeader.
 * @throws {CredentialsError} If credentials are not valid.
 */
export function getJiraCredentials( // Added export
  args: yup.InferType<typeof JiraUpdateIssueRequestSchema>,
  env: NodeJS.ProcessEnv
): { jiraHost: string; email: string; apiToken: string; authHeader: string } {
  const jiraHost = args.jiraHost || env.JIRA_HOST;
  const email = args.email || env.JIRA_EMAIL;
  const apiToken = args.apiToken || env.JIRA_API_TOKEN;

  validateCredentials(jiraHost, email, apiToken); // Throws CredentialsError if invalid

  // At this point, validateCredentials has confirmed they are strings
  const authHeader = createAuthHeader(email!, apiToken!);
  return { jiraHost: jiraHost!, email: email!, apiToken: apiToken!, authHeader };
}

/**
 * Searches for a Jira user by their display name or account ID.
 * Prefers an exact, active match on displayName, otherwise takes the first active user.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param jiraHost - The Jira host URL.
 * @param authHeader - The authentication header.
 * @param userName - The display name or account ID of the user to search for.
 * @returns A promise that resolves to the User object or undefined if not found.
 */
export async function searchJiraUser( // Added export
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  userName: string
): Promise<User | undefined> {
  const response = await axiosInstance.get<User[]>(
    `https://${jiraHost}/rest/api/3/user/search?query=${encodeURIComponent(userName)}`,
    { headers: { ...authHeader, 'Accept': 'application/json' } }
  );

  if (!response.data || response.data.length === 0) return undefined;

  // Prefer exact match on displayName (case-insensitive for robustness) for active users
  const exactMatch = response.data.find(
    u => u.displayName?.toLowerCase() === userName.toLowerCase() && u.active
  );
  if (exactMatch) return exactMatch;

  // Fallback: return the first active user if no exact displayName match
  return response.data.find(u => u.active);
}

/**
 * Builds the 'fields' part of the Jira issue update payload.
 * @param args - Object containing optional summary, description, and assigneeAccountId.
 * @param adfConverter - Function to convert string or ADFContent to ADFContent.
 * @returns The JiraUpdateIssuePayloadFields object.
 */
export function buildJiraUpdateFieldsPayload( // Added export
  args: { summary?: string; description?: string | ADFContent; assigneeAccountId?: string },
  adfConverter: (desc: string | ADFContent) => ADFContent
): JiraUpdateIssuePayloadFields {
  const fieldsToUpdate: JiraUpdateIssuePayloadFields = {};
  if (args.summary !== undefined) fieldsToUpdate.summary = args.summary; // Allow empty string for summary
  if (args.description !== undefined) fieldsToUpdate.description = adfConverter(args.description);
  if (args.assigneeAccountId) fieldsToUpdate.assignee = { accountId: args.assigneeAccountId };
  return fieldsToUpdate;
}

/**
 * Updates the specified fields on a Jira issue.
 * @param axiosInstance - The Axios instance.
 * @param jiraHost - The Jira host URL.
 * @param authHeader - The authentication header.
 * @param issueIdOrKey - The ID or key of the issue to update.
 * @param fieldsPayload - The payload containing the fields to update.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateJiraIssueFields( // Added export
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string,
  fieldsPayload: JiraUpdateIssuePayloadFields
): Promise<void> {
  await axiosInstance.put(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
    { fields: fieldsPayload },
    { headers: { ...authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
  );
}

/**
 * Fetches the available transitions for a Jira issue.
 * @param axiosInstance - The Axios instance.
 * @param jiraHost - The Jira host URL.
 * @param authHeader - The authentication header.
 * @param issueIdOrKey - The ID or key of the issue.
 * @returns A promise that resolves to an array of available transitions.
 */
export async function getJiraIssueTransitions( // Added export
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string
): Promise<Transition[]> {
  const response = await axiosInstance.get<{ transitions: Transition[] }>(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
    { headers: { ...authHeader, 'Accept': 'application/json' } }
  );
  return response.data.transitions || []; // Ensure an array is always returned
}

/**
 * Finds a target transition from a list of available transitions based on the target status name.
 * @param transitions - An array of available transitions.
 * @param targetStatusName - The name of the desired target status.
 * @returns The matching Transition object or undefined if not found.
 */
export function findTargetTransition( // Added export
  transitions: Transition[],
  targetStatusName: string
): Transition | undefined {
  return transitions.find(t => t.to.name.toLowerCase() === targetStatusName.toLowerCase());
}

/**
 * Applies a transition to a Jira issue.
 * @param axiosInstance - The Axios instance.
 * @param jiraHost - The Jira host URL.
 * @param authHeader - The authentication header.
 * @param issueIdOrKey - The ID or key of the issue.
 * @param transitionId - The ID of the transition to apply.
 * @returns A promise that resolves when the transition is complete.
 */
export async function postJiraIssueTransition( // Added export
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string,
  transitionId: string
): Promise<void> {
  await axiosInstance.post(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
    { transition: { id: transitionId } } as JiraTransitionPayload,
    { headers: { ...authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
  );
}

/**
 * Fetches the full details of a Jira issue.
 * @param axiosInstance - The Axios instance.
 * @param jiraHost - The Jira host URL.
 * @param authHeader - The authentication header.
 * @param issueIdOrKey - The ID or key of the issue.
 * @returns A promise that resolves to the Issue object.
 */
export async function fetchJiraIssueDetails( // Added export
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string
): Promise<Issue> {
  const response = await axiosInstance.get<Issue>(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
    { headers: { ...authHeader, 'Accept': 'application/json' } }
  );
  return response.data;
}

/**
 * Formats the success response message after updating an issue.
 * @param updatedIssue - The updated Issue object.
 * @param updatedFieldsMessages - An array of messages detailing what was updated.
 * @param jiraHost - The Jira host URL.
 * @returns A formatted Markdown string for the success message.
 */
export function formatSuccessResponseMessage( // Added export
  updatedIssue: Issue,
  updatedFieldsMessages: string[],
  jiraHost: string
): string {
  const issueLink = `https://${jiraHost}/browse/${updatedIssue.key}`;
  let formattedResponse = `## ✅ Issue Updated Successfully\n\nIssue [${updatedIssue.key}](${issueLink}) has been updated.`;

  if (updatedFieldsMessages.length > 0) {
    formattedResponse += "\n\n**Changed fields:**\n" + updatedFieldsMessages.join("\n");
  }
  
  if (updatedIssue.fields.status) {
      formattedResponse += `\n\n**Current Status:** ${updatedIssue.fields.status.name}`;
  }
  if (updatedIssue.fields.assignee) {
      formattedResponse += `\n**Current Assignee:** ${updatedIssue.fields.assignee.displayName}`;
  }
  return formattedResponse;
}

/**
 * Maps an error to the standard response format for the tool.
 * @param error - The error object (unknown type).
 * @param yupInstance - The yup library instance (for instanceof check).
 * @param isAxiosErrFn - The type guard function for AxiosError.
 * @param CredentialsErrorType - The CredentialsError class (for instanceof check).
 * @param issueIdOrKeyForContext - Optional issueIdOrKey to provide context in error messages.
 * @param jiraHostForContext - Optional jiraHost to provide context in error messages.
 * @returns An error response object with content and isError: true.
 */
export function mapErrorToResponseFormat( // Added export
  error: unknown,
  yupInstance: typeof yup,
  isAxiosErrFn: typeof isAxiosErr,
  CredentialsErrorType: typeof CredentialsError,
  issueIdOrKeyForContext?: string, // Added for better context in messages
  jiraHostForContext?: string // Added for better context in messages
): { content: {type: "text", text: string}[], isError: true } {
    let errorTitle = "Error Updating Jira Issue";
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unexpected error occurred while updating the issue.";
    let errorDetails = "";
    let errorSolution = "Please check the details and try again. If the issue persists, ensure your Jira instance is accessible and your credentials are correct.";

    if (error instanceof yupInstance.ValidationError) {
      errorTitle = "Validation Error";
      errorCode = "VALIDATION_ERROR";
      errorMessage = `The provided input is invalid: ${error.errors.join(', ')}`;
      errorDetails = `Path: ${error.path}, Value: ${JSON.stringify(error.value, null, 2)}`;
      errorSolution = "Please correct the input according to the validation rules and try again.";
    } else if (error instanceof CredentialsErrorType) {
      errorTitle = "Authentication Error";
      errorCode = "CREDENTIALS_MISSING";
      errorMessage = error.message;
      errorSolution = "Please ensure your Jira host, email, and API token are correctly configured either in the arguments or as environment variables (JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN).";
    } else if (isAxiosErrFn(error)) {
      if (error.response) {
        const { status, data } = error.response;
        const jiraErrors = data?.errorMessages?.join(', ') || (data?.errors ? JSON.stringify(data.errors) : '');
        errorTitle = `Jira API Error (${status})`;
        errorMessage = `The Jira API returned an error: ${jiraErrors || error.message}`;
        errorDetails = `Response Data: ${JSON.stringify(data, null, 2)}`;
        
        switch (status) {
          case 400: errorCode = "JIRA_BAD_REQUEST"; errorSolution = "The request was malformed. Check the provided parameters."; break;
          case 401: errorCode = "JIRA_UNAUTHORIZED"; errorSolution = "Authentication failed. Check your Jira email and API token."; break;
          case 403: errorCode = "JIRA_FORBIDDEN"; errorSolution = "You do not have permission to perform this action on the Jira issue."; break;
          case 404: errorCode = "JIRA_ISSUE_NOT_FOUND"; errorSolution = `Issue "${issueIdOrKeyForContext || 'N/A'}" could not be found. Please verify the issue ID or key.`; break;
          default: errorCode = "JIRA_API_ERROR"; errorSolution = "An unexpected API error occurred. Check the Jira API status or logs.";
        }
      } else if (error.request) {
        errorTitle = "Network Error";
        errorCode = "NETWORK_ERROR";
        errorMessage = `Could not connect to Jira host at ${jiraHostForContext || 'the specified host'}.`;
        errorSolution = "Please check your network connection and the Jira host URL.";
      } else {
        errorTitle = "Axios Error";
        errorCode = "AXIOS_ERROR";
        errorMessage = `An error occurred while setting up the API request: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorTitle = "Unexpected Application Error";
      errorCode = "APPLICATION_ERROR";
      errorMessage = "An unexpected error occurred within the application.";
      errorDetails = error.message;
      errorSolution = "Please report this error to the application maintainers.";
    } else {
      errorTitle = "Unknown Error Type";
      errorCode = "UNKNOWN_ERROR_TYPE";
      errorMessage = "An entirely unexpected and unknown type of error occurred.";
      errorDetails = String(error);
    }

    const formattedError = `## ❌ ${errorTitle}\n\n**Code:** ${errorCode}\n**Message:** ${errorMessage}${errorDetails ? `\n**Details:** ${errorDetails}` : ''}\n\n**Suggestion:** ${errorSolution}`;
    return { content: [{ type: "text", text: formattedError }], isError: true };
}
