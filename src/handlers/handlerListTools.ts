/**
 * Returns the common properties used across Jira tool schemas
 * 
 * @returns {Object} Common schema properties for Jira tools
 */
function getCommonJiraProperties() {
    return {
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
    };
}

/**
 * Handles listing available tools for the MCP server
 * 
 * @async
 * @param {Object} request - The request object from MCP
 * @returns {Object} List of available tools with their descriptions and schemas
 */
export async function handleListTools(request: any) {
    return {
        tools: [
            {
                name: "jira_list_projects",
                description: "Lists all Jira projects the user has access to",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                    },
                    required: [],
                },
            },
            {
                name: "jira_get_issue",
                description: "Retrieves details of a specific Jira issue by key",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        issueKey: {
                            type: "string",
                            description: "The Jira issue key (e.g., 'PROJECT-123')",
                        },
                    },
                    required: ["issueKey"],
                },
            },
            {
                name: "jira_search_issues",
                description: "Searches for Jira issues by project and assignee",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        projectKey: {
                            type: "string",
                            description: "The Jira project key (e.g., 'PROJECT')",
                        },
                        assigneeName: {
                            type: "string",
                            description: "The display name of the assignee to filter by (e.g., 'John Doe')",
                        },
                    },
                    required: ["projectKey"],
                },
            },
            {
                name: "jira_list_project_members",
                description: "Lists all members of a specific Jira project",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        projectKey: {
                            type: "string",
                            description: "The Jira project key (e.g., 'PROJECT')",
                        },
                    },
                    required: ["projectKey"],
                },
            },
            {
                name: "jira_check_user_issues",
                description: "Checks if a user is a member of a project and lists their assigned issues",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        projectKey: {
                            type: "string",
                            description: "The Jira project key (e.g., 'PROJECT')",
                        },
                        userName: {
                            type: "string",
                            description: "The display name of the user to check for in the project",
                        },
                    },
                    required: ["projectKey", "userName"],
                },
            },
        ],
    };
}
