import * as yup from "yup";

/**
 * Schema for validating basic Jira API requests
 * Contains common fields used by all Jira API requests
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraApiRequestSchema = yup.object({
    jiraHost: yup.string().default(process.env.JIRA_HOST || ""),
    email: yup.string().email().default(process.env.JIRA_EMAIL || ""),
    apiToken: yup.string().default(process.env.JIRA_API_TOKEN || ""),
});

/**
 * Schema for validating Jira issue requests
 * Extends the base API schema with the issueKey field
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraIssueRequestSchema = JiraApiRequestSchema.shape({
    issueKey: yup.string().required("Issue key is required"),
});

/**
 * Schema for validating Jira search issues requests
 * Extends the base API schema with the projectKey and optional assigneeName fields
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraSearchIssuesRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string().required("Project key is required"),
    assigneeName: yup.string(),
});

/**
 * Schema for validating Jira project members requests
 * Extends the base API schema with the projectKey field
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraProjectMembersRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string().required("Project key is required"),
});

/**
 * Schema for validating Jira check user issues requests
 * Extends the base API schema with the projectKey and userName fields
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraCheckUserIssuesRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string().required("Project key is required"),
    userName: yup.string().required("User name is required"),
});

/**
 * Schema for validating Jira create issue requests
 * Extends the base API schema with fields needed for issue creation
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraCreateIssueRequestSchema = JiraApiRequestSchema.shape({
    projectKey: yup.string().required("Project key is required"),
    summary: yup.string().required("Issue summary/title is required"),
    description: yup.string().required("Issue description is required"),
    issueType: yup.string().oneOf(['Task', 'Bug', 'Story', 'Epic'], "Issue type must be one of: Task, Bug, Story, Epic").default("Task"),
    assigneeName: yup.string(),
    reporterName: yup.string(),
    sprintId: yup.string(),
});

/**
 * Schema for validating Jira sprint query requests
 * Extends the base API schema with optional fields for filtering sprints
 * 
 * @type {yup.ObjectSchema}
 */
export const JiraSprintRequestSchema = JiraApiRequestSchema.shape({
    boardId: yup.string(),
    projectKey: yup.string(),
    state: yup.string().oneOf(['active', 'future', 'closed', 'all']).default('active'),
});
