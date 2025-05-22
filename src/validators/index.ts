import * as yup from "yup";

/**
 * Schema for validating basic Jira API requests
 * Contains common fields used by all Jira API requests
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraApiRequestSchema = yup.object({
    jiraHost: yup.string()
        .default(process.env.JIRA_HOST || "")
        .test(
            'check-jira-host',
            'Jira host is required and must be a valid domain (e.g., "company.atlassian.net")',
            (value) => !!value && value.trim().length > 0
        ),
    email: yup.string()
        .email('Invalid email format. Please provide a valid email associated with your Jira account')
        .default(process.env.JIRA_EMAIL || "")
        .test(
            'check-email',
            'Email is required for Jira authentication',
            (value) => !!value && value.trim().length > 0
        ),
    apiToken: yup.string()
        .default(process.env.JIRA_API_TOKEN || "")
        .test(
            'check-api-token',
            'API token is required for Jira authentication',
            (value) => !!value && value.trim().length > 0
        ),
});

/**
 * Schema for validating Jira issue requests
 * Extends the base API schema with the issueKey field
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraIssueRequestSchema = JiraApiRequestSchema.shape({
    issueKey: yup.string()
        .required("Issue key is required")
        .matches(/^[A-Z][A-Z0-9_]+-[1-9][0-9]*$/, "Invalid issue key format. The correct format is PROJECT-123"),
});

/**
 * Schema for validating Jira search issues requests
 * Extends the base API schema with the projectKey and optional assigneeName fields
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraSearchIssuesRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string()
        .required("Project key is required")
        .matches(/^[A-Z][A-Z0-9_]+$/, "Invalid project key format. Only uppercase letters, numbers, and underscores are allowed"),
    assigneeName: yup.string()
        .optional()
        .min(2, "Assignee name must be at least 2 characters long"),
});

/**
 * Schema for validating Jira project members requests
 * Extends the base API schema with the projectKey field
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraProjectMembersRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string()
        .required("Project key is required")
        .matches(/^[A-Z][A-Z0-9_]+$/, "Invalid project key format. Only uppercase letters, numbers, and underscores are allowed"),
});

/**
 * Schema for validating Jira check user issues requests
 * Extends the base API schema with the projectKey and userName fields
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraCheckUserIssuesRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string()
        .required("Project key is required")
        .matches(/^[A-Z][A-Z0-9_]+$/, "Invalid project key format. Only uppercase letters, numbers, and underscores are allowed"),
    userName: yup.string()
        .required("Username is required")
        .min(2, "Username must be at least 2 characters long"),
});

/**
 * Schema for validating Jira create issue requests
 * Extends the base API schema with fields needed for issue creation
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraCreateIssueRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string()
        .required("Project key is required")
        .matches(/^[A-Z][A-Z0-9_]+$/, "Invalid project key format. Only uppercase letters, numbers, and underscores are allowed")
        .test(
            'not-empty-project',
            'Project key cannot be empty',
            (value) => !!value && value.trim().length > 0
        ),
    summary: yup.string()
        .required("Issue summary/title is required")
        .min(3, "Issue title must be at least 3 characters long")
        .max(255, "Issue title must be at most 255 characters long"),
    description: yup.object({
        type: yup.string()
            .oneOf(['doc'], 'ADF document type must be "doc"')
            .required('ADF document type is required'),
        version: yup.number()
            .oneOf([1], 'ADF document version must be 1')
            .required('ADF document version is required'),
        content: yup.array()
            .required('ADF document content is required')
            .min(1, 'ADF document cannot be empty'),
    }).required('Issue description (in ADF format) is required')
        .typeError('Description must be in ADF (Atlassian Document Format)'),
    issueType: yup.string()
        .oneOf(
            ['Task', 'Bug', 'Story', 'Epic'],
            "Issue type must be one of: Task, Bug, Story, Epic"
        )
        .default("Task"),
    assigneeName: yup.string()
        .optional()
        .min(2, "Assignee name must be at least 2 characters long"),
    reporterName: yup.string()
        .optional()
        .min(2, "Reporter name must be at least 2 characters long"),
    sprintId: yup.string()
        .optional()
        .test(
            'valid-sprint-id',
            'Sprint ID must be numeric',
            (value) => !value || /^\d+$/.test(value)
        ),
});

/**
 * Schema for validating Jira sprint query requests
 * Extends the base API schema with optional fields for filtering sprints
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraSprintRequestSchema = JiraApiRequestSchema.shape({
    boardId: yup.string()
        .optional()
        .test(
            'valid-board-id',
            'Board ID must be numeric',
            (value) => !value || /^\d+$/.test(value)
        ),
    projectKey: yup.string()
        .optional()
        .matches(/^[A-Z][A-Z0-9_]+$/, "Invalid project key format. Only uppercase letters, numbers, and underscores are allowed"),
    state: yup.string()
        .oneOf(
            ['active', 'future', 'closed', 'all'],
            "Sprint state must be one of: active, future, closed, all"
        )
        .default('active'),
});

/**
 * Schema for validating Jira update issue requests.
 * Extends the base API schema with fields needed for updating an issue.
 * 
 * @type {yup.ObjectSchema}
 */
export { JiraUpdateIssueRequestSchema } from "./jiraUpdateIssueValidator.js";
