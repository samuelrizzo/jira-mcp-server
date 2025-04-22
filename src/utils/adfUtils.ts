/**
 * Utility to ensure the description field is in Atlassian Document Format (ADF).
 * If received an object already in ADF format, returns as is.
 * If received a string, converts to a simple doc ADF.
 */
export function toADF(description: any): any {
    if (!description) return {
        type: "doc",
        version: 1,
        content: [ { type: "paragraph", content: [] } ]
    };
    // If already an object of type doc ADF
    if (typeof description === "object" && description.type === "doc" && description.version === 1 && Array.isArray(description.content)) {
        return description;
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
                    ]
                }
            ]
        };
    }
    // Fallback
    return {
        type: "doc",
        version: 1,
        content: [ { type: "paragraph", content: [] } ]
    };
}
