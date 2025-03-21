import axios from "axios";
import { JiraApiRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira list projects tool
 * @typedef {Object} ListProjectsToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const listProjectsToolDescription = {
    name: "jira_list_projects",
    description: "Lists all Jira projects the user has access to",
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
        },
        required: [],
    },
};

/**
 * Lists all Jira projects that the user has access to
 * 
 * @async
 * @param {Object} args - The arguments for listing projects
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @returns {Promise<Object>} A formatted response with the list of projects
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function listProjects(args: any) {
    const validatedArgs = await JiraApiRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email, apiToken);

    try {
        const response = await axios.get(`https://${jiraHost}/rest/api/3/project`, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
            },
        });

        const projects = response.data;

        let formattedResponse = `# Jira Projects\n\n`;
        formattedResponse += `Total projects: ${projects.length}\n\n`;

        if (Array.isArray(projects) && projects.length > 0) {
            formattedResponse += `| Project Key | Name | Type | Lead |\n`;
            formattedResponse += `|------------|------|------|------|\n`;

            projects.forEach((project: any) => {
                formattedResponse += `| ${project.key} | ${project.name} | ${project.projectTypeKey || 'N/A'} | ${project.lead?.displayName || 'Unknown'} |\n`;
            });
        } else {
            formattedResponse += "No projects found or you don't have access to any projects.";
        }

        return {
            content: [{ type: "text", text: formattedResponse }],
            isError: false,
        };
    } catch (error: any) {
        let errorMsg = "An error occurred while listing projects.";

        if (error.response) {
            errorMsg = `Error ${error.response.status}: ${error.response.data?.errorMessages?.join(', ') || error.message}`;
        } else if (error.message) {
            errorMsg = error.message;
        }

        return {
            content: [{ type: "text", text: `# Error\n\n${errorMsg}` }],
            isError: true,
        };
    }
}
