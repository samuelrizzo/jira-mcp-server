import axios from "axios";
import { JiraCreateIssueRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";
import { toADF } from "../utils/adfUtils.js";
import { ADFContent, User } from '../jira-api-types.js'; // Added ADFContent, User

/**
 * Interface for the 'assignee' or 'reporter' field in a Jira issue payload.
 */
interface JiraIssueUserField {
  id: string;
}

/**
 * Interface for the 'fields' object within a Jira issue creation payload.
 */
interface CreateIssuePayloadFields {
  project: { key: string };
  summary: string;
  description: ADFContent; // Use the imported ADFContent
  issuetype: { name: string };
  assignee?: JiraIssueUserField;
  reporter?: JiraIssueUserField;
  // Add other potential custom fields if they are ever part of this payload
  // For now, keep it to what's in the existing issuePayload
  // sprintId is handled separately after issue creation for some Jira versions
}

/**
 * Interface for the main payload when creating a Jira issue.
 */
interface CreateIssuePayload {
  fields: CreateIssuePayloadFields;
}


/**
 * Description object for the Jira create issue tool
 * @typedef {Object} CreateIssueToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const createIssueToolDescription = {
    name: "jira_create_issue",
    description: "Creates a new issue in a Jira project with specified details",
    inputSchema: {
        type: "object",
        properties: {
            jiraHost: {
                type: "string",
                description: "The Jira host URL (e.g., 'your-domain.atlassian.net')",
                default: process.env.JIRA_HOST || "",
            },
            email: {
                type: "string",
                description: "Email address associated with the Jira account",
                default: process.env.JIRA_EMAIL || "",
            },
            apiToken: {
                type: "string",
                description: "API token for Jira authentication",
                default: process.env.JIRA_API_TOKEN || "",
            },
            projectKey: {
                type: "string",
                description: "The Jira project key (e.g., 'PROJECT')",
            },
            summary: {
                type: "string",
                description: "The title/summary of the issue",
            },
            description: { // Input description can be string or ADF
                type: ["object", "string"], // Allow string for initial input
                description: "The description for the Jira issue. Can be a plain string or an Atlassian Document Format (ADF) object.",
            },
            issueType: {
                type: "string",
                description: "Type of issue (e.g., 'Task', 'Bug', 'Story')",
                default: "Task",
            },
            assigneeName: {
                type: "string",
                description: "The display name of the person to assign the issue to",
            },
            reporterName: {
                type: "string",
                description: "The display name of the person reporting the issue",
            },
            sprintId: {
                type: "string",
                description: "ID of the sprint to add the issue to",
            },
        },
        required: ["projectKey", "summary", "description"],
    },
};

/**
 * Creates a new issue in a Jira project
 * 
 * @async
 * @param {Object} args - The arguments for creating the issue
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} args.projectKey - The project key
 * @param {string} args.summary - Issue title/summary
 * @param {string | ADFContent} args.description - Issue description (string or ADF JSON object)
 * @param {string} [args.issueType] - Type of issue
 * @param {string} [args.assigneeName] - Name of the assignee
 * @param {string} [args.reporterName] - Name of the reporter
 * @param {string} [args.sprintId] - ID of the sprint
 * @returns {Promise<Object>} A formatted response with the created issue details
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function createIssue(args: any) {
    const validatedArgs = await JiraCreateIssueRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const projectKey = validatedArgs.projectKey;
    const summary = validatedArgs.summary;
    // The input 'description' can be string or ADFContent. toADF handles both.
    const adfDescription = toADF(validatedArgs.description); 
    const issueType = validatedArgs.issueType || "Task";
    const assigneeName = validatedArgs.assigneeName;
    const reporterName = validatedArgs.reporterName;
    const sprintId = validatedArgs.sprintId;

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email, apiToken);

    try {
        const issuePayload: CreateIssuePayload = { // Applied strong type
            fields: {
                project: {
                    key: projectKey
                },
                summary: summary,
                description: adfDescription, // This is now strictly checked against ADFContent
                issuetype: {
                    name: issueType
                }
            }
        };

        // If assignee name is provided, get their accountId
        if (assigneeName) {
            try {
                const userResponse = await axios.get<User[]>(`https://${jiraHost}/rest/api/3/user/search`, {
                    params: {
                        query: assigneeName
                    },
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });

                if (userResponse.data && userResponse.data.length > 0) {
                    const assigneeUser = userResponse.data.find((user: User) =>
                        user.displayName.toLowerCase() === assigneeName.toLowerCase()
                    ) || userResponse.data[0];

                    issuePayload.fields.assignee = { // Conforms to JiraIssueUserField
                        id: assigneeUser.accountId 
                    };
                }
            } catch (error) {
                console.warn("Could not find assignee:", assigneeName);
            }
        }

        // If reporter name is provided, get their accountId
        if (reporterName) {
            try {
                const userResponse = await axios.get<User[]>(`https://${jiraHost}/rest/api/3/user/search`, {
                    params: {
                        query: reporterName
                    },
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });

                if (userResponse.data && userResponse.data.length > 0) {
                    const reporterUser = userResponse.data.find((user: User) =>
                        user.displayName.toLowerCase() === reporterName.toLowerCase()
                    ) || userResponse.data[0];

                    issuePayload.fields.reporter = { // Conforms to JiraIssueUserField
                        id: reporterUser.accountId
                    };
                }
            } catch (error) {
                console.warn("Could not find reporter:", reporterName);
            }
        }

        // Create the issue
        const response = await axios.post(`https://${jiraHost}/rest/api/3/issue`, issuePayload, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
        });

        const createdIssue = response.data;

        // Add the issue to a sprint if sprintId is provided
        if (sprintId && createdIssue.id) {
            try {
                await axios.post(`https://${jiraHost}/rest/agile/1.0/sprint/${sprintId}/issue`, {
                    issues: [createdIssue.id]
                }, {
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                });
            } catch (error) {
                console.warn("Could not add issue to sprint:", sprintId);
            }
        }

        // Fetch the created issue to get full details
        const issueResponse = await axios.get<Issue>(`https://${jiraHost}/rest/api/3/issue/${createdIssue.key}`, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
            },
        });

        const issue = issueResponse.data;
        const formattedDate = new Date().toLocaleString();

        let formattedResponse = `# Issue Created Successfully\n\n`;
        formattedResponse += `## Issue Details\n\n`;
        formattedResponse += `| Field | Value |\n`;
        formattedResponse += `|-------|-------|\n`;
        formattedResponse += `| Key | [${issue.key}](https://${jiraHost}/browse/${issue.key}) |\n`;
        formattedResponse += `| Summary | ${issue.fields.summary} |\n`;
        formattedResponse += `| Type | ${issue.fields.issuetype?.name || issueType} |\n`;
        formattedResponse += `| Project | ${projectKey} |\n`;
        formattedResponse += `| Created | ${formattedDate} |\n`;

        if (issue.fields.assignee) {
            formattedResponse += `| Assignee | ${issue.fields.assignee.displayName} |\n`;
        } else if (assigneeName) {
            formattedResponse += `| Assignee | ${assigneeName} (assignee may not have been found) |\n`;
        }

        if (issue.fields.reporter) {
            formattedResponse += `| Reporter | ${issue.fields.reporter.displayName} |\n`;
        } else if (reporterName) {
            formattedResponse += `| Reporter | ${reporterName} (reporter may not have been found) |\n`;
        }

        if (sprintId) {
            formattedResponse += `| Sprint | ${sprintId} |\n`;
        }

        let descriptionPreview = '';
        // Check adfDescription structure before trying to access its properties
        if (adfDescription && typeof adfDescription === 'object' && adfDescription.type === 'doc' && Array.isArray(adfDescription.content)) {
            descriptionPreview = adfDescription.content.map((block: any) => { // block is ADFNode, but any for simplicity here
                if (block.type === 'paragraph' && Array.isArray(block.content)) {
                    return block.content.map((c: any) => c.text).join(''); // c is ADFNode (text)
                }
                return '';
            }).join('\n');
        } else if (typeof validatedArgs.description === 'string') { // Fallback if it was a string
             descriptionPreview = validatedArgs.description;
        } else {
            descriptionPreview = '[Complex ADF description provided]';
        }
        formattedResponse += `\n## Description\n\n${descriptionPreview}\n\n`;
        formattedResponse += `\n**Issue link:** [${issue.key}](https://${jiraHost}/browse/${issue.key})\n`;

        return {
            content: [{ type: "text", text: formattedResponse }],
            isError: false,
        };
    } catch (error: any) {
        // Extract detailed error information
        let errorTitle = "Error Creating Jira Issue";
        let errorMsg = "An unexpected error occurred while creating the issue.";
        let errorDetails = "";
        let errorSolution = "";

        // Handle validation errors (from Yup schema)
        if (error.name === "ValidationError") {
            errorTitle = "Validation Error";
            errorMsg = "The provided data does not meet the requirements for creating a Jira issue.";
            errorDetails = error.message;
            errorSolution = "Please check the field requirements and provide all necessary information.";
        }
        // Handle authentication/credential errors
        else if (error.message && error.message.includes("credentials")) {
            errorTitle = "Authentication Error";
            errorMsg = "Failed to authenticate with Jira.";
            errorDetails = error.message;
            errorSolution = "Please verify your Jira host, email, and API token.";
        }
        // Handle user not found errors (assignee/reporter)
        else if (error.response && error.response.status === 400 && 
                 (error.response.data?.errors?.assignee || error.response.data?.errors?.reporter)) {
            errorTitle = "User Not Found Error";
            errorMsg = "One or more specified users could not be found in Jira.";
            errorDetails = JSON.stringify(error.response.data.errors, null, 2);
            errorSolution = "Check that the assignee and reporter names match existing users in your Jira instance.";
        }
        // Handle project not found errors
        else if (error.response && error.response.status === 404 && error.response.data?.errorMessages?.some((msg: string) => msg.includes("project"))) {
            errorTitle = "Project Not Found Error";
            errorMsg = `Project with key '${projectKey}' could not be found.`;
            errorDetails = error.response.data?.errorMessages?.join('\n') || "Project not found or you don't have permission to access it.";
            errorSolution = "Verify the project key and ensure you have access to the project.";
        }
        // Handle permission errors
        else if (error.response && error.response.status === 403) {
            errorTitle = "Permission Error";
            errorMsg = "You don't have permission to create issues in this project.";
            errorDetails = error.response.data?.errorMessages?.join('\n') || error.message;
            errorSolution = "Contact your Jira administrator to request the necessary permissions.";
        }
        // Handle rate limit errors
        else if (error.response && error.response.status === 429) {
            errorTitle = "Rate Limit Exceeded";
            errorMsg = "Too many requests sent to Jira API.";
            errorDetails = error.response.data?.errorMessages?.join('\n') || error.message;
            errorSolution = "Please wait before trying again.";
        }
        // Handle sprint errors
        else if (error.message && error.message.includes("sprint")) {
            errorTitle = "Sprint Error";
            errorMsg = "Failed to add issue to the specified sprint.";
            errorDetails = error.message;
            errorSolution = "Verify the sprint ID and ensure it is active and associated with the project.";
        }
        // Handle any other API response errors
        else if (error.response) {
            errorTitle = `API Error (${error.response.status})`;
            errorMsg = `The Jira API returned an error with status code ${error.response.status}.`;
            
            try {
                if (typeof error.response.data === 'object') {
                    errorDetails = JSON.stringify(error.response.data, null, 2);
                } else {
                    errorDetails = error.response.data || error.message;
                }
            } catch {
                errorDetails = error.message || "No additional details available.";
            }
            
            errorSolution = "Check the error details and adjust your request accordingly.";
        }
        // Handle network errors
        else if (error.request) {
            errorTitle = "Network Error";
            errorMsg = "Failed to connect to the Jira API.";
            errorDetails = error.message || "No response received from the server.";
            errorSolution = "Check your internet connection and verify the Jira host URL.";
        }
        // Fallback for any other errors
        else if (error.message) {
            errorDetails = error.message;
        }

        const formattedError = `# ${errorTitle}\n\n${errorMsg}\n\n`
            + (errorDetails ? `## Error Details\n\n\`\`\`\n${errorDetails}\n\`\`\`\n\n` : "")
            + (errorSolution ? `## Solution\n\n${errorSolution}` : "");

        return {
            content: [{ type: "text", text: formattedError }],
            isError: true,
        };
    }
}
