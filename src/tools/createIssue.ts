import axios from "axios";
import { JiraCreateIssueRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

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
            description: {
                type: "string",
                description: "Detailed description of the issue",
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
 * @param {string} args.description - Issue description
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
    const description = validatedArgs.description;
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
        // Create the issue payload
        const issuePayload: any = {
            fields: {
                project: {
                    key: projectKey
                },
                summary: summary,
                description: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: description
                                }
                            ]
                        }
                    ]
                },
                issuetype: {
                    name: issueType
                }
            }
        };

        // If assignee name is provided, get their accountId
        if (assigneeName) {
            try {
                const userResponse = await axios.get(`https://${jiraHost}/rest/api/3/user/search`, {
                    params: {
                        query: assigneeName
                    },
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });

                if (userResponse.data && userResponse.data.length > 0) {
                    const assigneeUser = userResponse.data.find((user: any) => 
                        user.displayName.toLowerCase() === assigneeName.toLowerCase()
                    ) || userResponse.data[0];
                    
                    issuePayload.fields.assignee = {
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
                const userResponse = await axios.get(`https://${jiraHost}/rest/api/3/user/search`, {
                    params: {
                        query: reporterName
                    },
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });

                if (userResponse.data && userResponse.data.length > 0) {
                    const reporterUser = userResponse.data.find((user: any) => 
                        user.displayName.toLowerCase() === reporterName.toLowerCase()
                    ) || userResponse.data[0];
                    
                    issuePayload.fields.reporter = {
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
        const issueResponse = await axios.get(`https://${jiraHost}/rest/api/3/issue/${createdIssue.key}`, {
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

        formattedResponse += `\n## Description\n\n${description}\n\n`;
        formattedResponse += `\n**Issue link:** [${issue.key}](https://${jiraHost}/browse/${issue.key})\n`;

        return {
            content: [{ type: "text", text: formattedResponse }],
            isError: false,
        };
    } catch (error: any) {
        let errorMsg = "An error occurred while creating the issue.";

        if (error.response) {
            errorMsg = `Error ${error.response.status}: ${JSON.stringify(error.response.data) || error.message}`;
        } else if (error.message) {
            errorMsg = error.message;
        }

        return {
            content: [{ type: "text", text: `# Error\n\n${errorMsg}` }],
            isError: true,
        };
    }
}
