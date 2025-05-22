import * as yup from 'yup';
import { ADFContent } from '../jira-api-types.js';

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
   * The ID or key of the Jira issue to be updated (e.g., "PROJECT-123" or "10001").
   * This field is required.
   */
  issueIdOrKey: yup.string().required(),

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
    'Description must be a string or a valid ADF object',
    value => {
      if (value === undefined || typeof value === 'string') return true;
      if (typeof value === 'object' && value !== null) {
        const adf = value as ADFContent; // Cast to ADFContent for type checking
        if (adf.type === 'doc' && adf.version === 1 && Array.isArray(adf.content)) {
          // Basic ADF structure check. For a more thorough validation,
          // one might iterate through adf.content and validate each node.
          return true;
        }
      }
      return false;
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
