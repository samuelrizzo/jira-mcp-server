/**
 * Creates a basic authorization header using email and API token
 * 
 * @param {string} email - The email address for Jira authentication
 * @param {string} apiToken - The API token for Jira authentication
 * @returns {string} The formatted authorization header string
 */
export function createAuthHeader(email: string, apiToken: string): string {
    return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

/**
 * Validates that the required Jira credentials are present
 * 
 * @param {string | undefined} jiraHost - The Jira host URL
 * @param {string | undefined} email - The email address for Jira authentication
 * @param {string | undefined} apiToken - The API token for Jira authentication
 * @throws {Error} If any of the required credentials are missing
 */
export function validateCredentials(jiraHost: string | undefined, email: string | undefined, apiToken: string | undefined): void {
    if (!jiraHost || !email || !apiToken) {
        throw new Error("Missing required Jira credentials. Please provide them in the request or set them in the .env file.");
    }
}
