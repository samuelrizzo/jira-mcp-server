import { ADFNode } from '../jira-api-types.js';

/**
 * Recursively validates an array of unknown objects to determine if they conform to the ADFNode structure.
 *
 * This function checks each node for the following:
 * 1. It's an object and not null.
 * 2. It has a non-empty `type` property of type string.
 * 3. If it has a `content` property, that property is an array, and its elements
 *    also conform to the ADFNode structure (checked via a recursive call).
 *
 * An empty array of nodes is considered valid.
 *
 * @param nodes - An array of items, expected to be potential ADF nodes.
 * @returns `true` if all items in the array are valid ADFNode structures (including nested content), `false` otherwise.
 */
export function isValidADFNodeArray(nodes: unknown[]): boolean {
  if (!Array.isArray(nodes)) {
    // This function specifically expects an array of nodes.
    // If the input itself is not an array, it's not a valid ADFNode array.
    return false;
  }

  for (const node of nodes) {
    // 1. Verify node is an object and not null
    if (typeof node !== 'object' || node === null) {
      return false;
    }

    const adfNode = node as ADFNode; // Cast for easier property access

    // 2. Verify node has a type property and typeof (node as ADFNode).type === 'string' && (node as ADFNode).type.length > 0
    if (typeof adfNode.type !== 'string' || adfNode.type.length === 0) {
      return false;
    }

    // 3. If (node as ADFNode).content exists:
    if (adfNode.content !== undefined) {
      // Verify Array.isArray((node as ADFNode).content)
      if (!Array.isArray(adfNode.content)) {
        return false;
      }
      // Recursively call isValidADFNodeArray((node as ADFNode).content as unknown[])
      if (!isValidADFNodeArray(adfNode.content as unknown[])) {
        return false;
      }
    }
  }

  // If all nodes in the array pass all checks
  return true;
}
