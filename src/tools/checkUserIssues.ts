import axios from "axios";
import { ProjectRole, RoleActor } from "../types/index.js";
import { JiraCheckUserIssuesRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira check user issues tool
 * @typedef {Object} CheckUserIssuesToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const checkUserIssuesToolDescription = {
    name: "jira_check_user_issues",
    description: "Checks if a user is a member of a project and lists their assigned issues",
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
            userName: {
                type: "string",
                description: "The display name of the user to check for in the project",
            },
        },
        required: ["projectKey", "userName"],
    },
};

/**
 * Checks if a user is a member of a project and lists their assigned issues
 * 
 * @async
 * @param {Object} args - The arguments for checking user issues
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} args.projectKey - The project key to check in
 * @param {string} args.userName - The display name of the user to check for
 * @returns {Promise<Object>} A formatted response with user membership status and assigned issues
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function checkUserIssues(args: any) {
    const validatedArgs = await JiraCheckUserIssuesRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const projectKey = validatedArgs.projectKey;
    const userName = validatedArgs.userName;

    if (!jiraHost || !email || !apiToken) {
        throw new Error('Missing required authentication credentials. Please provide jiraHost, email, and apiToken.');
    }

    validateCredentials(jiraHost, email, apiToken);

    const authHeader = createAuthHeader(email, apiToken);

    const rolesResponse = await axios.get(`https://${jiraHost}/rest/api/3/project/${projectKey}/role`, {
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
        },
    });

    const projectRoles = rolesResponse.data;

    let formattedResponse = `# Checking User "${userName}" in Project "${projectKey}"\n\n`;

    const allMembers = new Map<string, {
        displayName: string;
        type: string;
        email: string;
        roles: string[];
    }>();

    let userFound = false;

    if (Object.keys(projectRoles).length > 0) {
        const roleDetailsPromises: Promise<{
            roleName: string;
            data: ProjectRole;
        }>[] = [];

        for (const [roleName, roleUrl] of Object.entries(projectRoles)) {
            if (typeof roleUrl === 'string') {
                const roleId = roleUrl.split('/').pop();
                const detailUrl = `https://${jiraHost}/rest/api/3/project/${projectKey}/role/${roleId}`;

                roleDetailsPromises.push(
                    axios.get<ProjectRole>(detailUrl, {
                        headers: {
                            'Authorization': authHeader,
                            'Accept': 'application/json',
                        },
                    }).then(response => ({
                        roleName,
                        data: response.data
                    }))
                );
            }
        }

        const roleDetails = await Promise.all(roleDetailsPromises);

        for (const { roleName, data } of roleDetails) {
            if (data.actors && data.actors.length > 0) {
                data.actors.forEach((actor: RoleActor) => {
                    if (actor.displayName) {
                        if (!allMembers.has(actor.displayName)) {
                            allMembers.set(actor.displayName, {
                                displayName: actor.displayName,
                                type: actor.type,
                                email: actor.emailAddress || 'N/A',
                                roles: [roleName]
                            });
                        } else {
                            const member = allMembers.get(actor.displayName);
                            if (member) {
                                member.roles.push(roleName);
                            }
                        }

                        if (actor.displayName.toLowerCase() === userName.toLowerCase()) {
                            userFound = true;
                        }
                    }
                });
            }
        }

        formattedResponse += `## Step 1: Checking if user "${userName}" is a member of project "${projectKey}"\n\n`;

        if (userFound) {
            const userInfo = allMembers.get(Array.from(allMembers.keys()).find(
                name => name.toLowerCase() === userName.toLowerCase()
            ) || "");

            formattedResponse += `✅ User "${userName}" found in project with the following roles: ${userInfo?.roles.join(', ')}\n\n`;

            formattedResponse += `## Step 2: Fetching issues assigned to "${userName}" in project "${projectKey}"\n\n`;

            const jql = `project = "${projectKey}" AND assignee = "${userName}" ORDER BY created DESC`;

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

            if (issues.length > 0) {
                formattedResponse += "| Issue Key | Summary | Status | Type | Created |\n";
                formattedResponse += "|-----------|---------|--------|------|--------|\n";

                issues.forEach((issue: any) => {
                    const key = issue.key;
                    const summary = issue.fields.summary || 'No summary';
                    const status = issue.fields.status?.name || 'Unknown';
                    const type = issue.fields.issuetype?.name || 'Unknown';
                    const created = new Date(issue.fields.created).toLocaleDateString();

                    formattedResponse += `| ${key} | ${summary} | ${status} | ${type} | ${created} |\n`;
                });
            } else {
                formattedResponse += "No issues found assigned to this user in the project.";
            }
        } else {
            formattedResponse += `❌ User "${userName}" is NOT a member of project "${projectKey}". No issues will be fetched.\n\n`;
            formattedResponse += "### Available Project Members:\n\n";
            formattedResponse += "| Name | Roles |\n";
            formattedResponse += "|------|-------|\n";

            allMembers.forEach(member => {
                if (member.type !== "atlassian-user-role-actor" ||
                    (!member.displayName.includes("for Jira") &&
                        !member.displayName.includes("Atlassian"))) {
                    formattedResponse += `| ${member.displayName} | ${member.roles.join(', ')} |\n`;
                }
            });
        }
    } else {
        formattedResponse += "⚠️ No project roles found. Unable to determine project membership.";
    }

    return {
        content: [{ type: "text", text: formattedResponse }],
        isError: false,
    };
}
