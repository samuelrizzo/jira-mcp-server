import { ADFContent, ADFNode } from "../jira-api-types.js"; // Added .js

/**
 * Utility to ensure the description field is in Atlassian Document Format (ADF).
 * If `description` is an object already in ADF format, it's returned as is.
 * If `description` is a string, it's converted to a simple ADF document structure.
 * If `description` is empty or undefined, a minimal valid ADF document is returned.
 *
 * @param description - The description content, either a string or an ADFContent object.
 * @returns The description in ADFContent format.
 */
export function toADF(description: string | ADFContent | undefined): ADFContent {
    if (!description) {
        return {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [] as ADFNode[] }] // Ensure content is ADFNode[]
        };
    }

    // If already an object of type doc ADF (ADFContent)
    if (typeof description === "object" && description.type === "doc" && description.version === 1 && Array.isArray(description.content)) {
        return description as ADFContent; // Type assertion
    }

    // If string, convert to basic ADF
    if (typeof description === "string") {
        return {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: description }
                    ] as ADFNode[] // Ensure content is ADFNode[]
                }
            ]
        };
    }

    // Fallback for any other unexpected type, though the type signature should prevent this.
    // However, to be safe and ensure ADFContent is always returned:
    return {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [] as ADFNode[] }] // Ensure content is ADFNode[]
    };
}
