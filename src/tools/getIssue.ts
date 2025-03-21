import axios from "axios";
import { JiraIssueRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira get issue tool
 * @typedef {Object} GetIssueToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const getIssueToolDescription = {
    name: "jira_get_issue",
    description: "Retrieves detailed information about a specific Jira issue by key",
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
            issueKey: {
                type: "string",
                description: "The Jira issue key (e.g., 'PROJECT-123')",
            },
        },
        required: ["issueKey"],
    },
};

/**
 * Retrieves detailed information about a specific Jira issue
 * 
 * @async
 * @param {Object} args - The arguments for retrieving the issue
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} args.issueKey - The issue key to retrieve
 * @returns {Promise<Object>} A formatted response with the issue details
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function getIssue(args: any) {
    const validatedArgs = await JiraIssueRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const issueKey = validatedArgs.issueKey;

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email, apiToken);

    try {
        const response = await axios.get(`https://${jiraHost}/rest/api/3/issue/${issueKey}`, {
            params: {
                expand: 'renderedFields,names,changelog,operations',
                fields: 'summary,status,assignee,issuetype,priority,created,creator,reporter,description,comment,attachment,worklog,updated,labels,fixVersions,components,duedate'
            },
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
            },
        });

        const issue = response.data;
        const formattedDate = new Date(issue.fields.created).toLocaleString();
        const updatedDate = issue.fields.updated ? new Date(issue.fields.updated).toLocaleString() : 'Not updated';

        let formattedResponse = `# Issue: ${issue.key} - ${issue.fields.summary}\n\n`;

        formattedResponse += `## Basic Information\n\n`;
        formattedResponse += `| Field | Value |\n`;
        formattedResponse += `|-------|-------|\n`;
        formattedResponse += `| Status | ${issue.fields.status?.name || 'Unknown'} |\n`;
        formattedResponse += `| Type | ${issue.fields.issuetype?.name || 'Unknown'} |\n`;
        formattedResponse += `| Priority | ${issue.fields.priority?.name || 'Not set'} |\n`;
        formattedResponse += `| Assignee | ${issue.fields.assignee?.displayName || 'Unassigned'} |\n`;
        formattedResponse += `| Reporter | ${issue.fields.reporter?.displayName || 'Unknown'} |\n`;
        formattedResponse += `| Created | ${formattedDate} |\n`;
        formattedResponse += `| Updated | ${updatedDate} |\n`;

        if (issue.fields.duedate) {
            const dueDate = new Date(issue.fields.duedate).toLocaleString();
            formattedResponse += `| Due Date | ${dueDate} |\n`;
        }

        if (issue.fields.labels && issue.fields.labels.length > 0) {
            formattedResponse += `| Labels | ${issue.fields.labels.join(', ')} |\n`;
        }

        if (issue.fields.components && issue.fields.components.length > 0) {
            const componentNames = issue.fields.components.map((comp: any) => comp.name).join(', ');
            formattedResponse += `| Components | ${componentNames} |\n`;
        }

        if (issue.fields.fixVersions && issue.fields.fixVersions.length > 0) {
            const fixVersionNames = issue.fields.fixVersions.map((ver: any) => ver.name).join(', ');
            formattedResponse += `| Fix Versions | ${fixVersionNames} |\n`;
        }

        if (issue.fields.description) {
            formattedResponse += `\n## Description\n\n${issue.renderedFields?.description || issue.fields.description}\n`;
        }

        if (issue.fields.comment && issue.fields.comment.comments && issue.fields.comment.comments.length > 0) {
            formattedResponse += `\n## Comments (${issue.fields.comment.comments.length})\n\n`;

            issue.fields.comment.comments.forEach((comment: any, index: number) => {
                const commentDate = new Date(comment.created).toLocaleString();
                formattedResponse += `### Comment ${index + 1} - ${comment.author.displayName} (${commentDate})\n\n`;
                formattedResponse += `${comment.body}\n\n`;
            });
        }

        if (issue.fields.attachment && issue.fields.attachment.length > 0) {
            formattedResponse += `\n## Attachments (${issue.fields.attachment.length})\n\n`;
            formattedResponse += `| Filename | Size | Uploaded by | Date |\n`;
            formattedResponse += `|----------|------|-------------|------|\n`;

            issue.fields.attachment.forEach((attachment: any) => {
                const attachmentDate = new Date(attachment.created).toLocaleString();
                const sizeInKb = Math.round(attachment.size / 1024);
                formattedResponse += `| ${attachment.filename} | ${sizeInKb} KB | ${attachment.author.displayName} | ${attachmentDate} |\n`;
            });
        }

        if (issue.fields.worklog && issue.fields.worklog.worklogs && issue.fields.worklog.worklogs.length > 0) {
            formattedResponse += `\n## Work Log (${issue.fields.worklog.worklogs.length})\n\n`;
            formattedResponse += `| User | Time Spent | Date | Comment |\n`;
            formattedResponse += `|------|------------|------|--------|\n`;

            issue.fields.worklog.worklogs.forEach((worklog: any) => {
                const worklogDate = new Date(worklog.started).toLocaleString();
                formattedResponse += `| ${worklog.author.displayName} | ${worklog.timeSpent} | ${worklogDate} | ${worklog.comment || 'No comment'} |\n`;
            });
        }

        if (issue.changelog && issue.changelog.histories && issue.changelog.histories.length > 0) {
            formattedResponse += `\n## Change History\n\n`;
            formattedResponse += `| Date | User | Changes |\n`;
            formattedResponse += `|------|------|--------|\n`;

            issue.changelog.histories.forEach((history: any) => {
                const historyDate = new Date(history.created).toLocaleString();
                const changes = history.items.map((item: any) => {
                    return `${item.field} changed from "${item.fromString || 'none'}" to "${item.toString || 'none'}"`;
                }).join('; ');

                formattedResponse += `| ${historyDate} | ${history.author.displayName} | ${changes} |\n`;
            });
        }

        return {
            content: [{ type: "text", text: formattedResponse }],
            isError: false,
        };
    } catch (error: any) {
        let errorMsg = "An error occurred while retrieving the issue.";

        if (error.response) {
            if (error.response.status === 404) {
                errorMsg = `Issue ${issueKey} not found or you don't have permission to view it.`;
            } else {
                errorMsg = `Error ${error.response.status}: ${error.response.data?.errorMessages?.join(', ') || error.message}`;
            }
        } else if (error.message) {
            errorMsg = error.message;
        }

        return {
            content: [{ type: "text", text: `# Error\n\n${errorMsg}` }],
            isError: true,
        };
    }
}
