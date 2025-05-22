import * as yup from 'yup';
import { ADFContent } from '../jira-api-types.js';
import { isValidADFNodeArray } from './adfValidationUtils.js';

/**
 * Defines the validation schema for the `jira_update_issue` tool request.
 * This schema is used to ensure that the input provided to the tool meets the required criteria.
 */
export const JiraUpdateIssueRequestSchema = yup.object({
  /**
   * The Jira host URL (e.g., "your-domain.atlassian.net").
   * Optional, as it can also be configured via environment variables.
   */
  jiraHost: yup.string().optional(),

  /**
   * The email address of the user performing the update.
   * Optional, as it can also be configured via environment variables.
   * Must be a valid email format if provided.
   */
  email: yup.string().email().optional(),

  /**
   * The API token for authenticating with the Jira API.
   * Optional, as it can also be configured via environment variables.
   */
  apiToken: yup.string().optional(),

  /**
   * The ID or key of the Jira issue to be updated.
   * Must be a valid Jira issue key (e.g., 'PROJ-123', 'TEST_PROJECT-007') or a numeric issue ID (e.g., '10001').
   * This field is required.
   * @pattern /^[A-Z][A-Z0-9_]+-\d+$|^\d+$/
   */
  issueIdOrKey: yup
    .string()
    .required()
    .matches(
      /^[A-Z][A-Z0-9_]+-\d+$|^\d+$/,
      'issueIdOrKey must be a valid Jira issue key (e.g., PROJ-123) or a numeric issue ID.'
    ),

  /**
   * The new summary for the Jira issue.
   * Optional. If provided, it must not be an empty string.
   */
  summary: yup.string().optional().min(1),

  /**
   * The new description for the Jira issue.
   * Optional. Can be a plain string or a valid Atlassian Document Format (ADF) object.
   * The custom test 'is-string-or-adf' validates its structure.
   */
  description: yup.mixed<string | ADFContent>().optional().test(
    'is-string-or-adf',
    'Description must be a string or a valid ADF object (with valid node structure)',
    (value: unknown): boolean => {
      if (value === undefined || typeof value === 'string') {
        return true; // Allow undefined or string
      }
      if (
        typeof value === 'object' &&
        value !== null &&
        (value as ADFContent).type === 'doc' &&
        (value as ADFContent).version === 1 &&
        Array.isArray((value as ADFContent).content)
      ) {
        // Now use the helper function for deep validation of the content array
        return isValidADFNodeArray((value as ADFContent).content);
      }
      return false; // Not a string and not a valid ADF object structure
    }
  ),

  /**
   * The name or ID of the status to transition the issue to.
   * Optional. If provided, it must not be an empty string.
   */
  status: yup.string().optional().min(1),

  /**
   * The display name or account ID of the user to assign the issue to.
   * Optional. If provided, it must not be an empty string.
   */
  assigneeName: yup.string().optional().min(1),
});
