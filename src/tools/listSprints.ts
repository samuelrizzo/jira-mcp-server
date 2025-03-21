import axios from "axios";
import { JiraSprintRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira list sprints tool
 * @typedef {Object} ListSprintsToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const listSprintsToolDescription = {
    name: "jira_list_sprints",
    description: "Lists current sprints in Jira with filtering options",
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
};

/**
 * Lists current sprints in Jira
 * 
 * @async
 * @param {Object} args - The arguments for retrieving sprints
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} [args.boardId] - Optional board ID to filter by
 * @param {string} [args.projectKey] - Optional project key to filter by
 * @param {string} [args.state] - Sprint state to filter by (active, future, closed, or all)
 * @returns {Promise<Object>} A formatted response with the sprints information
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function listSprints(args: any) {
    const validatedArgs = await JiraSprintRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const boardId = validatedArgs.boardId;
    const projectKey = validatedArgs.projectKey;
    const state = validatedArgs.state || 'active';

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email, apiToken);

    try {
        let boardIds: string[] = [];

        if (boardId) {
            boardIds.push(boardId);
        } 
        
        else if (projectKey) {
            const boardResponse = await axios.get(`https://${jiraHost}/rest/agile/1.0/board`, {
                params: {
                    projectKeyOrId: projectKey
                },
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
            });

            if (boardResponse.data.values && boardResponse.data.values.length > 0) {
                boardIds = boardResponse.data.values.map((board: any) => board.id);
            } else {
                return {
                    content: [{ type: "text", text: `# No Boards Found\n\nNo boards were found for project key: ${projectKey}` }],
                    isError: false,
                };
            }
        } 
        
        else {
            const boardResponse = await axios.get(`https://${jiraHost}/rest/agile/1.0/board`, {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
            });

            if (boardResponse.data.values && boardResponse.data.values.length > 0) {
                
                boardIds = boardResponse.data.values.slice(0, 5).map((board: any) => board.id);
            } else {
                return {
                    content: [{ type: "text", text: `# No Boards Found\n\nNo boards were found in your Jira instance.` }],
                    isError: false,
                };
            }
        }

        
        let allSprints: any[] = [];
        
        for (const bId of boardIds) {
            try {
                const sprintParams: any = {};
                
                
                if (state !== 'all') {
                    sprintParams.state = state;
                }
                
                const sprintResponse = await axios.get(`https://${jiraHost}/rest/agile/1.0/board/${bId}/sprint`, {
                    params: sprintParams,
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });

                if (sprintResponse.data.values && sprintResponse.data.values.length > 0) {
                    
                    const sprintsWithBoardInfo = sprintResponse.data.values.map((sprint: any) => ({
                        ...sprint,
                        boardId: bId
                    }));
                    
                    allSprints = [...allSprints, ...sprintsWithBoardInfo];
                }
            } catch (error) {
                console.warn(`Could not fetch sprints for board ${bId}`);
            }
        }

        if (allSprints.length === 0) {
            let message = `# No Sprints Found\n\n`;
            
            if (state !== 'all') {
                message += `No ${state} sprints were found`;
            } else {
                message += `No sprints were found`;
            }
            
            if (boardId) {
                message += ` for board ID: ${boardId}`;
            } else if (projectKey) {
                message += ` for project key: ${projectKey}`;
            }
            
            return {
                content: [{ type: "text", text: message }],
                isError: false,
            };
        }

        
        allSprints.sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return dateB - dateA;
        });

        
        let formattedResponse = `# ${state.charAt(0).toUpperCase() + state.slice(1)} Sprints\n\n`;

        formattedResponse += `| ID | Name | Board | Status | Start Date | End Date |\n`;
        formattedResponse += `|----|------|-------|--------|------------|----------|\n`;

        allSprints.forEach(sprint => {
            const startDate = sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : 'Not started';
            const endDate = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'Not set';
            const status = sprint.state.charAt(0).toUpperCase() + sprint.state.slice(1);
            
            formattedResponse += `| ${sprint.id} | ${sprint.name} | ${sprint.boardId} | ${status} | ${startDate} | ${endDate} |\n`;
        });

        
        formattedResponse += `\n## Sprint Details\n\n`;

        for (const sprint of allSprints) {
            formattedResponse += `### ${sprint.name} (ID: ${sprint.id})\n\n`;
            
            
            formattedResponse += `**Board ID:** ${sprint.boardId}\n`;
            formattedResponse += `**Status:** ${sprint.state.charAt(0).toUpperCase() + sprint.state.slice(1)}\n`;
            
            if (sprint.startDate) {
                formattedResponse += `**Start Date:** ${new Date(sprint.startDate).toLocaleString()}\n`;
            }
            
            if (sprint.endDate) {
                formattedResponse += `**End Date:** ${new Date(sprint.endDate).toLocaleString()}\n`;
            }
            
            if (sprint.goal) {
                formattedResponse += `**Goal:** ${sprint.goal}\n`;
            }
            
            formattedResponse += `**View in Jira:** https://${jiraHost}/jira/software/projects/${projectKey || 'browse'}/boards/${sprint.boardId}/sprints/${sprint.id}\n\n`;
            
            
            try {
                const issuesResponse = await axios.get(`https://${jiraHost}/rest/agile/1.0/sprint/${sprint.id}/issue`, {
                    params: {
                        fields: 'summary,status,assignee,issuetype'
                    },
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                    },
                });
                
                if (issuesResponse.data.issues && issuesResponse.data.issues.length > 0) {
                    const issues = issuesResponse.data.issues;
                    
                    formattedResponse += `#### Issues (${issues.length})\n\n`;
                    formattedResponse += `| Key | Summary | Type | Status | Assignee |\n`;
                    formattedResponse += `|-----|---------|------|--------|----------|\n`;
                    
                    issues.forEach((issue: any) => {
                        const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned';
                        const status = issue.fields.status ? issue.fields.status.name : 'Unknown';
                        const type = issue.fields.issuetype ? issue.fields.issuetype.name : 'Task';
                        
                        formattedResponse += `| [${issue.key}](https://${jiraHost}/browse/${issue.key}) | ${issue.fields.summary} | ${type} | ${status} | ${assignee} |\n`;
                    });
                } else {
                    formattedResponse += `No issues found in this sprint.\n`;
                }
            } catch (error) {
                formattedResponse += `Could not fetch issues for this sprint.\n`;
            }
            
            formattedResponse += `\n---\n\n`;
        }

        return {
            content: [{ type: "text", text: formattedResponse }],
            isError: false,
        };
    } catch (error: any) {
        let errorMsg = "An error occurred while retrieving sprints.";

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
