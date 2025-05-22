export interface User {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    active: boolean;
    timeZone?: string;
    locale?: string;
    avatarUrls?: Record<string, string>;
}

export interface Project {
    id: string;
    key: string;
    name: string;
    description?: string;
    lead?: User;
    style?: string;
    url?: string;
    isPrivate?: boolean;
    projectTypeKey?: string;
    simplified?: boolean;
    avatarUrls?: Record<string, string>;
}

export interface IssueType {
    id: string;
    name: string;
    description?: string;
    subtask?: boolean;
    avatarId?: number;
    iconUrl?: string;
}

export interface Component {
    id: string;
    name: string;
    description?: string;
    lead?: User;
    assigneeType?: string;
    assignee?: User;
    realAssigneeType?: string;
    realAssignee?: User;
    isAssigneeTypeValid?: boolean;
    project?: string;
    projectId?: number;
}

export interface Issue {
    id: string;
    key: string;
    self: string;
    fields: {
        summary?: string;
        status?: {
            id: string;
            name: string;
            statusCategory?: {
                id: number;
                key: string;
                name: string;
                colorName: string;
            };
        };
        assignee?: User;
        reporter?: User;
        issuetype?: IssueType;
        priority?: {
            id: string;
            name: string;
            iconUrl?: string;
        };
        created?: string;
        updated?: string;
        duedate?: string;
        description?: string;
        components?: Component[];
        labels?: string[];
        [key: string]: any; 
    };
}

export interface ProjectRole {
    id: number;
    name: string;
    description?: string;
    actors?: RoleActor[];
    scope?: {
        type: string;
        project?: {
            id: string;
            key: string;
            name: string;
        };
    };
}

export interface RoleActor {
    id: number;
    displayName: string;
    type: string;
    name?: string;
    avatarUrl?: string;
    actorGroup?: {
        name: string;
        displayName: string;
    };
    emailAddress?: string;
}

/**
 * Represents a mark in an Atlassian Document Format (ADF) node.
 * Marks are used to add formatting like bold, italics, links, etc.
 */
export interface ADFMark {
    /** The type of the mark (e.g., "strong", "em", "link"). */
    type: string;
    /** Attributes for the mark, such as the URL for a link. */
    attrs?: Record<string, any>;
}

/**
 * Represents a node in an Atlassian Document Format (ADF) document.
 * Nodes can be blocks (like paragraphs, headings) or inline (like text, mentions).
 */
export interface ADFNode {
    /** The type of the ADF node (e.g., "paragraph", "text", "mention"). */
    type: string;
    /** Attributes for the node, providing additional information. */
    attrs?: Record<string, any>;
    /** Child nodes, for nodes that can contain other nodes (e.g., a paragraph containing text nodes). */
    content?: ADFNode[];
    /** The textual content of the node, if it's a text node. */
    text?: string;
    /** Marks applied to the node, for formatting. */
    marks?: ADFMark[];
}

/**
 * Represents the top-level structure of an Atlassian Document Format (ADF) document.
 */
export interface ADFContent {
    /** The type of the document, always "doc". */
    type: "doc";
    /** The version of the ADF schema. */
    version: 1;
    /** An array of ADF nodes that make up the content of the document. */
    content: ADFNode[];
}

/**
 * Interface for the 'fields' object within a Jira issue update payload.
 */
export interface JiraUpdateIssuePayloadFields {
    /** The summary of the issue. */
    summary?: string;
    /** The description of the issue, in Atlassian Document Format. */
    description?: ADFContent;
    /** The assignee of the issue. */
    assignee?: { accountId: string };
}

/**
 * Interface for the main payload when updating a Jira issue.
 */
export interface JiraUpdateIssuePayload {
    /** The fields to be updated in the issue. */
    fields?: JiraUpdateIssuePayloadFields;
}

/**
 * Interface for the payload when transitioning a Jira issue.
 */
export interface JiraTransitionPayload {
    /** The transition to be performed. */
    transition: { id: string };
}

/**
 * Represents an available transition for a Jira issue.
 */
export interface Transition {
    /** The ID of the transition. */
    id: string;
    /** The name of the transition (e.g., "Start Progress", "Close Issue"). */
    name: string;
    /** Details about the status the issue will move to if this transition is applied. */
    to: {
        /** The name of the target status (e.g., "In Progress", "Done"). */
        name: string;
        /** The ID of the target status. */
        id: string;
        // Other fields like statusCategory might be present but are not strictly needed for this interface
    };
    // Other fields like `hasScreen`, `isGlobal`, etc., might be present
}
