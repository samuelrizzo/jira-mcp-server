import axios from "axios";
import { ProjectRole, RoleActor } from "../types/index.js";
import { JiraProjectMembersRequestSchema } from "../validators/index.js";
import { createAuthHeader, validateCredentials } from "../utils/auth.js";

/**
 * Description object for the Jira list project members tool
 * @typedef {Object} ListProjectMembersToolDescription
 * @property {string} name - The name of the tool
 * @property {string} description - Description of the tool's functionality
 * @property {Object} inputSchema - Schema defining the expected input parameters
 */
export const listProjectMembersToolDescription = {
    name: "jira_list_project_members",
    description: "Lists all members of a specific Jira project",
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
        },
        required: ["projectKey"],
    },
};

/**
 * Lists all members of a specific Jira project
 * 
 * @async
 * @param {Object} args - The arguments for listing project members
 * @param {string} args.jiraHost - The Jira host URL
 * @param {string} args.email - Email for authentication
 * @param {string} args.apiToken - API token for authentication
 * @param {string} args.projectKey - The project key to get members for
 * @returns {Promise<Object>} A formatted response with the list of project members
 * @throws {Error} If the required credentials are missing or the request fails
 */
export async function listProjectMembers(args: any) {
    const validatedArgs = await JiraProjectMembersRequestSchema.validate(args);

    const jiraHost = validatedArgs.jiraHost || process.env.JIRA_HOST;
    const email = validatedArgs.email || process.env.JIRA_EMAIL;
    const apiToken = validatedArgs.apiToken || process.env.JIRA_API_TOKEN;
    const projectKey = validatedArgs.projectKey;

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

    let formattedResponse = `# Project Members for ${projectKey}\n\n`;

    if (Object.keys(projectRoles).length > 0) {

        const allMembers = new Map<string, {
            displayName: string;
            type: string;
            email: string;
            roles: string[];
        }>();
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
                    }
                });
            }
        }

        if (allMembers.size > 0) {
            formattedResponse += "| Name | Type | Email | Roles |\n";
            formattedResponse += "|------|------|-------|-------|\n";

            allMembers.forEach(member => {
                formattedResponse += `| ${member.displayName} | ${member.type} | ${member.email} | ${member.roles.join(', ')} |\n`;
            });
        } else {
            formattedResponse += "No project members found.";
        }
    } else {
        formattedResponse += "No project roles found.";
    }

    return {
        content: [{ type: "text", text: formattedResponse }],
        isError: false,
    };
}
