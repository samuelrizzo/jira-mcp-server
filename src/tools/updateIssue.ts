import axios, { AxiosError } from 'axios';
import * as yup from 'yup';
import { JiraUpdateIssueRequestSchema } from '../validators/index.js';
import { createAuthHeader, validateCredentials } from '../utils/auth.js';
import { toADF } from '../utils/adfUtils.js';
import { ADFContent, JiraUpdateIssuePayload, JiraTransitionPayload, User, Issue } from '../jira-api-types.js';

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
  try {
    // Validate arguments
    const validatedArgs = await JiraUpdateIssueRequestSchema.validate(args, { abortEarly: false, stripUnknown: true });

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email!, apiToken!);
    const { issueIdOrKey, summary, description, status, assigneeName } = validatedArgs;

    const fieldsToUpdate: JiraUpdateIssuePayload['fields'] = {};
    const updatedFieldsMessages: string[] = [];

    // 1. Summary
    if (summary) {
      fieldsToUpdate.summary = summary;
      updatedFieldsMessages.push("- Summary updated");
    }

    // 2. Description
    if (description) {
      const adfDescription = toADF(description);
      fieldsToUpdate.description = adfDescription;
      updatedFieldsMessages.push("- Description updated");
    }

    // 3. Assignee
    if (assigneeName) {
      try {
        const userSearchResponse = await axios.get<User[]>(
          `https://${jiraHost}/rest/api/3/user/search?query=${encodeURIComponent(assigneeName)}`,
          { headers: { ...authHeader, 'Accept': 'application/json' } }
        );

        if (userSearchResponse.data && userSearchResponse.data.length > 0) {
          // Prefer exact match on displayName, otherwise take the first active user
          let foundUser = userSearchResponse.data.find(u => u.displayName === assigneeName && u.active);
          if (!foundUser) {
            foundUser = userSearchResponse.data.find(u => u.active);
          }
          
          if (foundUser) {
            fieldsToUpdate.assignee = { accountId: foundUser.accountId };
            updatedFieldsMessages.push(`- Assignee updated to ${foundUser.displayName}`);
          } else {
            // No active user found
            return {
              content: [{ type: "text", text: `## ⚠️ Warning\n\nCould not find an active user matching "${assigneeName}". Assignee not updated.` }],
              isError: true, // Consider if this should be a non-blocking warning
            };
          }
        } else {
          return {
            content: [{ type: "text", text: `## ⚠️ Warning\n\nUser "${assigneeName}" not found. Assignee not updated.` }],
            isError: true, // Consider if this should be a non-blocking warning
          };
        }
      } catch (error) {
        // Handle errors during assignee search (e.g., network, API specific)
        const errorMessage = (error as AxiosError).isAxiosError ? (error as AxiosError).response?.data?.errorMessages?.join(', ') || (error as AxiosError).message : (error as Error).message;
        return {
          content: [{ type: "text", text: `## ⚠️ Warning\n\nError finding assignee "${assigneeName}": ${errorMessage}. Assignee not updated.` }],
          isError: true, // Consider if this should be a non-blocking warning
        };
      }
    }

    // Update fields (Summary, Description, Assignee) if any
    if (Object.keys(fieldsToUpdate).length > 0) {
      await axios.put(
        `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
        { fields: fieldsToUpdate },
        { headers: { ...authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
      );
    }

    // 4. Status Update
    if (status) {
      try {
        const transitionsResponse = await axios.get<{ transitions: { id: string; name: string; to: { name: string; } }[] }>(
          `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
          { headers: { ...authHeader, 'Accept': 'application/json' } }
        );

        const targetTransition = transitionsResponse.data.transitions.find(
          t => t.to.name.toLowerCase() === status.toLowerCase()
        );

        if (targetTransition) {
          await axios.post(
            `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}/transitions`,
            { transition: { id: targetTransition.id } } as JiraTransitionPayload,
            { headers: { ...authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
          );
          updatedFieldsMessages.push(`- Status updated to "${targetTransition.to.name}"`);
        } else {
          // No matching transition found - return a warning, but proceed if other fields were updated
          const availableTransitions = transitionsResponse.data.transitions.map(t => t.to.name).join(', ') || "None available";
          const warningMessage = `## ⚠️ Warning\n\nStatus transition to "${status}" not available for issue ${issueIdOrKey}. Available transitions: ${availableTransitions}.`;
          // If other updates were made, we'll append this warning to the success message later.
          // If only status was to be updated and failed, this will be the main message.
          if (updatedFieldsMessages.length === 0) {
             return { content: [{ type: "text", text: warningMessage }], isError: true };
          }
          updatedFieldsMessages.push(`- ⚠️ Status transition to "${status}" failed: Not available. Available: ${availableTransitions}`);
        }
      } catch (error) {
         const errorMessage = (error as AxiosError).isAxiosError ? (error as AxiosError).response?.data?.errorMessages?.join(', ') || (error as AxiosError).message : (error as Error).message;
         const warningMessage = `## ⚠️ Warning\n\nError transitioning status for issue ${issueIdOrKey}: ${errorMessage}.`;
         if (updatedFieldsMessages.length === 0) {
            return { content: [{ type: "text", text: warningMessage }], isError: true };
         }
         updatedFieldsMessages.push(`- ⚠️ Status transition failed: ${errorMessage}`);
      }
    }

    if (updatedFieldsMessages.length === 0) {
      return { content: [{ type: "text", text: "No fields provided for update, or status transition was not possible and no other fields were specified." }], isError: false };
    }

    // Fetch the updated issue data to return comprehensive info
    const updatedIssueResponse = await axios.get<Issue>(
      `https://${jiraHost}/rest/api/3/issue/${issueIdOrKey}`,
      { headers: { ...authHeader, 'Accept': 'application/json' } }
    );
    const updatedIssue = updatedIssueResponse.data;

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


    return { content: [{ type: "text", text: formattedResponse }], isError: false };

  } catch (error: any) {
    let errorMessage = "An unexpected error occurred while updating the Jira issue.";
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof yup.ValidationError) {
      errorMessage = `Validation Error: ${error.errors.join(', ')}`;
      errorCode = "VALIDATION_ERROR";
    } else if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      if (axiosError.response) {
        const { status, data } = axiosError.response;
        const jiraErrors = data?.errorMessages?.join(', ') || data?.errors ? JSON.stringify(data.errors) : '';
        errorMessage = `Jira API Error (Status ${status}): ${jiraErrors || axiosError.message}`;
        if (status === 400) errorCode = "JIRA_BAD_REQUEST";
        else if (status === 401) errorCode = "JIRA_UNAUTHORIZED";
        else if (status === 403) errorCode = "JIRA_FORBIDDEN";
        else if (status === 404) errorCode = "JIRA_ISSUE_NOT_FOUND";
        else errorCode = "JIRA_API_ERROR";
      } else if (axiosError.request) {
        errorMessage = `Network Error: Could not connect to Jira host at ${args.jiraHost || process.env.JIRA_HOST}. Please check the host and network connection.`;
        errorCode = "NETWORK_ERROR";
      } else {
        errorMessage = `Axios Error: ${axiosError.message}`;
        errorCode = "AXIOS_ERROR";
      }
    } else if (error.message.includes("Missing Jira credentials")) {
        errorMessage = error.message;
        errorCode = "CREDENTIALS_MISSING";
    } else {
      errorMessage = `Error: ${error.message}`;
    }

    const formattedError = `## ❌ Error Updating Jira Issue\n\n**Code:** ${errorCode}\n**Message:** ${errorMessage}\n\nPlease check the details and try again. If the issue persists, ensure your Jira instance is accessible and your credentials are correct.`;
    return { content: [{ type: "text", text: formattedError }], isError: true };
  }
}
