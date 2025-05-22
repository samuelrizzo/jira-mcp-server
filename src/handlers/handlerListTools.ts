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
            {
                name: "jira_create_issue",
                description: "Creates a new issue in a Jira project with specified details",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        projectKey: {
                            type: "string",
                            description: "The Jira project key (e.g., 'PROJECT')",
                        },
                        summary: {
                            type: "string",
                            description: "The title/summary of the issue",
                        },
                        description: {
                            type: "object",
                            description: "Issue description in ADF (Atlassian Document Format). REQUIRED: Must be an object with structure: {\"type\": \"doc\", \"version\": 1, \"content\": [{\"type\": \"paragraph\", \"content\": [{\"type\": \"text\", \"text\": \"Your description text\"}]}]}",
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
            },
            {
                name: "jira_list_sprints",
                description: "Lists current sprints in Jira with filtering options",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...getCommonJiraProperties(),
                        boardId: {
                            type: "string",
                            description: "Optional Jira board ID to filter sprints by a specific board",
                        },
                        projectKey: {
                            type: "string",
                            description: "Optional project key to find sprints associated with the project",
                        },
                        state: {
                            type: "string",
                            description: "Sprint state to filter by (active, future, closed, or all)",
                            default: "active",
                            enum: ["active", "future", "closed", "all"]
                        },
                    },
                    required: [],
                },
            },
        ],
    };
}
