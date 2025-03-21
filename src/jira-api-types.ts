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
