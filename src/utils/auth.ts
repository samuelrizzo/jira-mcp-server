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
import { CredentialsError } from "../types/index.js";

/**
 * Validates that the required Jira credentials are present
 * 
 * @param {string | undefined} jiraHost - The Jira host URL
 * @param {string | undefined} email - The email address for Jira authentication
 * @param {string | undefined} apiToken - The API token for Jira authentication
 * @throws {CredentialsError} If any of the required credentials are missing
 */
export function validateCredentials(jiraHost: string | undefined, email: string | undefined, apiToken: string | undefined): void {
    const missingFields: string[] = [];
    if (!jiraHost) missingFields.push("Jira host");
    if (!email) missingFields.push("email");
    if (!apiToken) missingFields.push("API token");

    if (missingFields.length > 0) {
        const message = `Missing required Jira credentials: ${missingFields.join(', ')}. Please provide them in the request or set them as environment variables (JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN).`;
        throw new CredentialsError(message);
    }
}
