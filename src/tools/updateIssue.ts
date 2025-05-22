import axios, { AxiosError } from 'axios';
import * as yup from 'yup';
import { JiraUpdateIssueRequestSchema } from '../validators/index.js';
import { createAuthHeader, validateCredentials } from '../utils/auth.js';
import { toADF } from '../utils/adfUtils.js';
import { ADFContent, JiraUpdateIssuePayload, JiraTransitionPayload, User, Issue, JiraUpdateIssuePayloadFields, JiraErrorResponseData } from '../jira-api-types.js'; // Added JiraErrorResponseData
import { KnownError, CredentialsError } from '../types/index.js';
import { isAxiosErr } from '../utils/index.js';
import { AxiosStatic } from 'axios'; // For axiosInstance type
import { Transition } from '../jira-api-types.js'; // Ensure this is imported

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

        // 4. Handle Assignee Update (using new helper)
        if (validatedArgs.assigneeName) {
            assigneeAccountId = await handleAssigneeUpdateInternal(
                axios,
                jiraHost,
                authHeader,
                validatedArgs.assigneeName,
                updatedFieldsMessages
            );
        }

        // 5. Build Fields Payload (using renamed helper)
        fieldsToUpdate = buildFieldsPayload(
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

        // 7. Handle Status Transition (using new helper)
        if (validatedArgs.status) {
            await handleStatusUpdateInternal(
                axios,
                jiraHost,
                authHeader,
                validatedArgs.issueIdOrKey,
                validatedArgs.status,
                updatedFieldsMessages
            );
        }
        
        // 8. Check if any action was performed or attempted
        if (Object.keys(fieldsToUpdate).length === 0 && !validatedArgs.status && !validatedArgs.assigneeName) {
             return {
                content: [{ type: "text", text: "No update parameters provided. No changes made to the issue." }],
                isError: false, 
            };
        }
        if (updatedFieldsMessages.length === 0 && validatedArgs.assigneeName && Object.keys(fieldsToUpdate).length === 0 && !validatedArgs.status){
             updatedFieldsMessages.push(`- ⚠️ Warning: Assignee '${validatedArgs.assigneeName}' not found or not active. No other updates performed.`);
        }


        // 9. Fetch Updated Issue Details
        const updatedIssue = await fetchJiraIssueDetails(axios, jiraHost, authHeader, validatedArgs.issueIdOrKey);

        // 10. Format Success Response (using renamed helper)
        const successMessage = formatSuccessResponse(updatedIssue, updatedFieldsMessages, jiraHost);
        return {
            content: [{ type: "text", text: successMessage }],
            isError: false,
        };

    } catch (error: unknown) {
        // 11. Format Error Response
        const finalIssueIdOrKey = issueIdOrKeyForErrorContext || (typeof args.issueIdOrKey === 'string' ? args.issueIdOrKey : "N/A");
        const finalJiraHost = jiraHostForErrorContext || (typeof args.jiraHost === 'string' && args.jiraHost) || process.env.JIRA_HOST || "N/A";
        
        return mapErrorToResponse( 
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

async function handleAssigneeUpdateInternal(
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  assigneeName: string,
  updatedFieldsMessages: string[]
): Promise<string | undefined> {
  try {
    const assignee = await searchJiraUser(axiosInstance, jiraHost, authHeader, assigneeName);
    if (assignee) {
      return assignee.accountId;
    } else {
      updatedFieldsMessages.push(`- ⚠️ Warning: Assignee '${assigneeName}' not found or not active. Assignee not changed.`);
      return undefined;
    }
  } catch (searchError) {
    const searchErrorMessage = isAxiosErr(searchError) ? searchError.message : (searchError instanceof Error ? searchError.message : "Unknown error during assignee search");
    updatedFieldsMessages.push(`- ⚠️ Warning: Error searching for assignee '${assigneeName}': ${searchErrorMessage}. Assignee not changed.`);
    return undefined;
  }
}

async function handleStatusUpdateInternal(
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string,
  targetStatusName: string,
  updatedFieldsMessages: string[]
): Promise<void> {
  try {
    const transitions = await getJiraIssueTransitions(axiosInstance, jiraHost, authHeader, issueIdOrKey);
    const targetTransition = findTargetTransition(transitions, targetStatusName);

    if (targetTransition) {
      await postJiraIssueTransition(axiosInstance, jiraHost, authHeader, issueIdOrKey, targetTransition.id);
      updatedFieldsMessages.push(`- Status changed to "${targetTransition.to.name}".`);
    } else {
      const availableTransitions = transitions.map(t => t.to.name).join(', ') || "None available";
      updatedFieldsMessages.push(`- ⚠️ Warning: Status transition to "${targetStatusName}" not available or already in this state. Available transitions: ${availableTransitions}.`);
    }
  } catch (transitionError) {
    const transitionErrorMessage = isAxiosErr(transitionError) ? transitionError.message : (transitionError instanceof Error ? transitionError.message : "Unknown error during status transition");
    updatedFieldsMessages.push(`- ⚠️ Warning: Error during status transition: ${transitionErrorMessage}.`);
  }
}

export function getJiraCredentials( 
  args: yup.InferType<typeof JiraUpdateIssueRequestSchema>,
  env: NodeJS.ProcessEnv
): { jiraHost: string; email: string; apiToken: string; authHeader: string } {
  const jiraHost = args.jiraHost || env.JIRA_HOST;
  const email = args.email || env.JIRA_EMAIL;
  const apiToken = args.apiToken || env.JIRA_API_TOKEN;

  validateCredentials(jiraHost, email, apiToken); 

  const authHeader = createAuthHeader(email!, apiToken!);
  return { jiraHost: jiraHost!, email: email!, apiToken: apiToken!, authHeader };
}

export async function searchJiraUser( 
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  userName: string
): Promise<User | undefined> {
  const response = await axiosInstance.get<User[]>(
    `https://${jiraHost}/rest/api/3/user/search?query=${encodeURIComponent(userName)}`,
    { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
  );

  if (!response.data || response.data.length === 0) return undefined;

  const exactMatch = response.data.find(
    u => u.displayName?.toLowerCase() === userName.toLowerCase() && u.active
  );
  if (exactMatch) return exactMatch;

  return response.data.find(u => u.active);
}

export function buildFieldsPayload( 
  args: { summary?: string; description?: string | ADFContent; assigneeAccountId?: string },
  adfConverter: (desc: string | ADFContent) => ADFContent
): JiraUpdateIssuePayloadFields {
  const fieldsToUpdate: JiraUpdateIssuePayloadFields = {};
  if (args.summary !== undefined) fieldsToUpdate.summary = args.summary; 
  if (args.description !== undefined) fieldsToUpdate.description = adfConverter(args.description);
  if (args.assigneeAccountId) fieldsToUpdate.assignee = { accountId: args.assigneeAccountId };
  return fieldsToUpdate;
}

export async function updateJiraIssueFields( 
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string,
  fieldsPayload: JiraUpdateIssuePayloadFields
): Promise<void> {
  await axiosInstance.put(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
    { fields: fieldsPayload },
    { headers: { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
  );
}

export async function getJiraIssueTransitions( 
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string
): Promise<Transition[]> {
  const response = await axiosInstance.get<{ transitions: Transition[] }>(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
    { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
  );
  return response.data.transitions || []; 
}

export function findTargetTransition( 
  transitions: Transition[],
  targetStatusName: string
): Transition | undefined {
  return transitions.find(t => t.to.name.toLowerCase() === targetStatusName.toLowerCase());
}

export async function postJiraIssueTransition( 
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string,
  transitionId: string
): Promise<void> {
  await axiosInstance.post(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
    { transition: { id: transitionId } } as JiraTransitionPayload,
    { headers: { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
  );
}

export async function fetchJiraIssueDetails( 
  axiosInstance: AxiosStatic,
  jiraHost: string,
  authHeader: string,
  issueIdOrKey: string
): Promise<Issue> {
  const response = await axiosInstance.get<Issue>(
    `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
    { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
  );
  return response.data;
}

export function formatSuccessResponse( 
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

export function mapErrorToResponse( 
  error: unknown,
  yupInstance: typeof yup,
  isAxiosErrFn: typeof isAxiosErr,
  CredentialsErrorType: typeof CredentialsError,
  issueIdOrKeyForContext?: string, 
  jiraHostForContext?: string 
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
        // Cast data to the defined interface
        const responseData = data as JiraErrorResponseData; 
        
        let jiraErrors = "";
        if (responseData?.errorMessages && Array.isArray(responseData.errorMessages)) {
            jiraErrors = responseData.errorMessages.join(', ');
        } else if (responseData?.errors) {
            if (typeof responseData.errors === 'object' && responseData.errors !== null && !Array.isArray(responseData.errors)) {
                try {
                    jiraErrors = JSON.stringify(responseData.errors);
                } catch (e) {
                    jiraErrors = "Could not stringify Jira field errors.";
                }
            } else if (Array.isArray(responseData.errors) && responseData.errors.every(e => typeof e === 'string')) {
                jiraErrors = responseData.errors.join(', ');
            } else if (Array.isArray(responseData.errors)) {
                try {
                    jiraErrors = JSON.stringify(responseData.errors);
                } catch (e) {
                     jiraErrors = "Could not stringify Jira errors array.";
                }
            }
        }

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
