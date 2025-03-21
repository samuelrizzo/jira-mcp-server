import axios from "axios";
import { JiraSearchIssuesRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira search issues tool
 * @typedef {Object} SearchIssuesToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const searchIssuesToolDescription = {
    name: "jira_search_issues",
    description: "Searches for Jira issues by project and assignee",
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
            assigneeName: {
                type: "string",
                description: "The display name of the assignee to filter by (e.g., 'John Doe')",
            },
        },
        required: ["projectKey"],
    },
};

/**
 * Searches for Jira issues by project key and optional assignee name
 * 
 * @async
 * @param {Object} args - The arguments for the search
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} args.projectKey - The project key to search in
 * @param {string} [args.assigneeName] - Optional assignee name to filter by
 * @returns {Promise<Object>} A formatted response with the search results
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function searchIssues(args: any) {
    const validatedArgs = await JiraSearchIssuesRequestSchema.validate(args);
    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const projectKey = validatedArgs.projectKey;
    const assigneeName = validatedArgs.assigneeName;

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    let jql = `project = "${projectKey}"`;
    if (assigneeName) {
        jql += ` AND assignee ~ "${assigneeName}"`;
    }
    jql += ` ORDER BY created DESC`;

    const authHeader = createAuthHeader(email, apiToken);

    const response = await axios.get(`https://${jiraHost}/rest/api/3/search`, {
        params: {
            jql,
            maxResults: 50,
            fields: "summary,status,assignee,created,issuetype,priority",
        },
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
        },
    });

    const searchResults = response.data;
    const issues = searchResults.issues || [];

    let formattedResponse = `# Issues for Project: ${projectKey}`;
    if (assigneeName) {
        formattedResponse += ` assigned to ${assigneeName}`;
    }
    formattedResponse += "\n\n";

    if (issues.length > 0) {
        formattedResponse += "| Issue Key | Summary | Status | Type | Assignee | Created |\n";
        formattedResponse += "|-----------|---------|--------|------|----------|--------|\n";

        issues.forEach((issue: any) => {
            const key = issue.key;
            const summary = issue.fields.summary || 'No summary';
            const status = issue.fields.status?.name || 'Unknown';
            const type = issue.fields.issuetype?.name || 'Unknown';
            const assignee = issue.fields.assignee?.displayName || 'Unassigned';
            const created = new Date(issue.fields.created).toLocaleDateString();

            formattedResponse += `| ${key} | ${summary} | ${status} | ${type} | ${assignee} | ${created} |\n`;
        });
    } else {
        formattedResponse += "No issues found matching the specified criteria.";
    }

    return {
        content: [{ type: "text", text: formattedResponse }],
        isError: false,
    };
}
