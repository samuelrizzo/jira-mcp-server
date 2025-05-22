import * as yup from "yup";
import {
    listProjects,
    getIssue,
    searchIssues,
    listProjectMembers,
    checkUserIssues,
    createIssue,
    listSprints,
    updateIssue
} from "../tools/index.js";
import {
    JiraApiRequestSchema,
    JiraIssueRequestSchema,
    JiraSearchIssuesRequestSchema,
    JiraProjectMembersRequestSchema,
    JiraCheckUserIssuesRequestSchema,
    JiraCreateIssueRequestSchema,
    JiraSprintRequestSchema,
    JiraUpdateIssueRequestSchema
} from "../validators/index.js";
import { validateCredentials } from "../utils/auth.js";

interface ToolConfig {
    schema: yup.ObjectSchema<any>;
    handler: (args: any) => Promise<any>;
}

const toolConfigs: Record<string, ToolConfig> = {
    jira_list_projects: {
        schema: JiraApiRequestSchema,
        handler: listProjects
    },
    jira_get_issue: {
        schema: JiraIssueRequestSchema,
        handler: getIssue
    },
    jira_search_issues: {
        schema: JiraSearchIssuesRequestSchema,
        handler: searchIssues
    },
    jira_list_project_members: {
        schema: JiraProjectMembersRequestSchema,
        handler: listProjectMembers
    },
    jira_check_user_issues: {
        schema: JiraCheckUserIssuesRequestSchema,
        handler: checkUserIssues
    },
    jira_create_issue: {
        schema: JiraCreateIssueRequestSchema,
        handler: createIssue
    },
    jira_list_sprints: {
        schema: JiraSprintRequestSchema,
        handler: listSprints
    },
    jira_update_issue: {
        schema: JiraUpdateIssueRequestSchema,
        handler: updateIssue
    }
};

async function validateAndGetCredentials(args: any) {
    const jiraHost = args.jiraHost || process.env.JIRA_HOST;
    const email = args.email || process.env.JIRA_EMAIL;
    const apiToken = args.apiToken || process.env.JIRA_API_TOKEN;

    validateCredentials(jiraHost, email, apiToken);
    return args;
}

/**
 * Handles tool calls from the MCP client
 * 
 * @async
 * @param {Object} request - The request object from MCP
 * @returns {Object} The result of the tool execution
 * @throws {Error} If the tool name is not recognized or execution fails
 */
export async function handleCallTool(request: any) {
    const { name, arguments: args } = request.params;

    try {
        const toolConfig = toolConfigs[name];
        if (!toolConfig) {
            return {
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true,
            };
        }

        const validatedArgs = await toolConfig.schema.validate(args);
        const argsWithCredentials = await validateAndGetCredentials(validatedArgs);
        return await toolConfig.handler(argsWithCredentials);

    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
}
