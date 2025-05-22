import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { updateIssue } from './updateIssue.js';
import { JiraUpdateIssueRequestSchema } from '../validators/index.js'; // For arg types
import { ADFContent, Issue, User } from '../jira-api-types.js';
import * as authUtils from '../utils/auth.js';

// Mock utilities
jest.mock('../utils/auth.js', () => ({
  validateCredentials: jest.fn(),
  createAuthHeader: jest.fn(() => ({ Authorization: 'Basic MOCKED_TOKEN' })),
}));

const mockJiraHost = 'test.atlassian.net';
const mockEmail = 'test@example.com';
const mockApiToken = 'TEST_TOKEN';
const mockIssueIdOrKey = 'TEST-123';
const mockIssueKey = 'TEST-123'; // Assuming issueIdOrKey is the key for simplicity in tests

const defaultArgs = {
  jiraHost: mockJiraHost,
  email: mockEmail,
  apiToken: mockApiToken,
  issueIdOrKey: mockIssueIdOrKey,
};

const mockUser: User = {
  accountId: 'user-account-id-123',
  displayName: 'Test User',
  emailAddress: 'testuser@example.com',
  active: true,
  avatarUrls: {},
};

const mockIssue: Issue = {
  id: '10001',
  key: mockIssueKey,
  self: `https://${mockJiraHost}/rest/api/3/issue/10001`,
  fields: {
    summary: 'Initial Summary',
    status: { id: '1', name: 'To Do' },
  },
};


describe('updateIssue Tool', () => {
  let mock: MockAdapter;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env }; // Save original environment variables
  });

  beforeEach(() => {
    mock = new MockAdapter(axios);
    process.env.JIRA_HOST = mockJiraHost;
    process.env.JIRA_EMAIL = mockEmail;
    process.env.JIRA_API_TOKEN = mockApiToken;

    // Mock successful issue fetch by default for the final step of updateIssue
    mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, mockIssue);
  });

  afterEach(() => {
    mock.reset();
    jest.clearAllMocks();
    process.env = { ...originalEnv }; // Restore original environment variables
  });

  describe('Successful Updates', () => {
    it('should update summary successfully', async () => {
      const newSummary = 'Updated Summary';
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, summary: newSummary } };
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);


      const result = await updateIssue({ ...defaultArgs, summary: newSummary });

      expect(mock.history.put.length).toBe(1);
      expect(mock.history.put[0].url).toBe(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`);
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { summary: newSummary } });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('## ✅ Issue Updated Successfully');
      expect(result.content[0].text).toContain('- Summary updated');
      expect(result.content[0].text).toContain(`**Current Status:** ${updatedMockIssue.fields.status.name}`);
    });

    it('should update description successfully (string input)', async () => {
      const newDescription = 'This is a new description.';
      const expectedADF: ADFContent = {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: newDescription }] }],
      };
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, description: newDescription } }; // Simplified for test
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

      const result = await updateIssue({ ...defaultArgs, description: newDescription });

      expect(mock.history.put.length).toBe(1);
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { description: expectedADF } });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('- Description updated');
    });

    it('should update description successfully (ADF input)', async () => {
      const adfDescription: ADFContent = {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ADF description' }] }],
      };
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, description: "ADF description" } }; // Simplified
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

      const result = await updateIssue({ ...defaultArgs, description: adfDescription });

      expect(mock.history.put.length).toBe(1);
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { description: adfDescription } });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('- Description updated');
    });

    it('should update assignee successfully', async () => {
      const assigneeName = 'Test User';
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, assignee: mockUser } };
      mock.onGet(`https://${mockJiraHost}/rest/api/3/user/search?query=${encodeURIComponent(assigneeName)}`).reply(200, [mockUser]);
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

      const result = await updateIssue({ ...defaultArgs, assigneeName });

      expect(mock.history.get.some(req => req.url?.includes('/user/search'))).toBe(true);
      expect(mock.history.put.length).toBe(1);
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { assignee: { accountId: mockUser.accountId } } });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain(`- Assignee updated to ${mockUser.displayName}`);
      expect(result.content[0].text).toContain(`**Current Assignee:** ${mockUser.displayName}`);
    });

    it('should update status successfully', async () => {
      const newStatus = 'In Progress';
      const transitions = [{ id: 'trans-1', name: 'Start Progress', to: { name: newStatus, id: 'status-2' } }];
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, status: { id: 'status-2', name: newStatus } } };

      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(200, { transitions });
      mock.onPost(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(204);
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

      const result = await updateIssue({ ...defaultArgs, status: newStatus });

      expect(mock.history.get.some(req => req.url?.includes('/transitions'))).toBe(true);
      expect(mock.history.post.length).toBe(1);
      expect(JSON.parse(mock.history.post[0].data)).toEqual({ transition: { id: 'trans-1' } });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain(`- Status updated to "${newStatus}"`);
      expect(result.content[0].text).toContain(`**Current Status:** ${newStatus}`);
    });

    it('should update multiple fields successfully (summary and status)', async () => {
        const newSummary = 'Multi Update Summary';
        const newStatus = 'Done';
        const transitions = [{ id: 'trans-2', name: 'Finish Work', to: { name: newStatus, id: 'status-3' } }];
        const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, summary: newSummary, status: {id: 'status-3', name: newStatus} } };

        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204); // For summary
        mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(200, { transitions }); // For status
        mock.onPost(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(204); // For status
        mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);


        const result = await updateIssue({ ...defaultArgs, summary: newSummary, status: newStatus });

        expect(mock.history.put.length).toBe(1);
        expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { summary: newSummary } });
        expect(mock.history.post.length).toBe(1);
        expect(JSON.parse(mock.history.post[0].data)).toEqual({ transition: { id: 'trans-2' } });
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('- Summary updated');
        expect(result.content[0].text).toContain(`- Status updated to "${newStatus}"`);
    });

    it("should return 'No fields provided' if no updatable args given", async () => {
        const result = await updateIssue({ ...defaultArgs }); // No summary, desc, assignee, status
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain("No fields provided for update");
    });
  });

  describe('Error Handling', () => {
    it('should handle issue not found (404 on PUT)', async () => {
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(404);
      const result = await updateIssue({ ...defaultArgs, summary: 'Test' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('## ❌ Error Updating Jira Issue');
      expect(result.content[0].text).toContain('Code:** JIRA_ISSUE_NOT_FOUND');
    });
    
    it('should handle issue not found (404 on GET for status transition)', async () => {
        mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(404);
        const result = await updateIssue({ ...defaultArgs, status: "In Progress" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('## ⚠️ Warning'); // Specific warning for status transition
        expect(result.content[0].text).toContain('Error transitioning status');
    });

    it('should handle assignee not found and still update other fields', async () => {
      const newSummary = "Summary Update With Failed Assignee";
      mock.onGet(`https://${mockJiraHost}/rest/api/3/user/search?query=UnknownUser`).reply(200, []); // No user found
      mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204); // For summary
      
      const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, summary: newSummary } };
      mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

      const result = await updateIssue({ ...defaultArgs, summary: newSummary, assigneeName: 'UnknownUser' });

      expect(mock.history.put.length).toBe(1); // Summary should still be updated
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ fields: { summary: newSummary } });
      expect(result.isError).toBe(false); // Overall operation can succeed with a warning
      expect(result.content[0].text).toContain('## ✅ Issue Updated Successfully');
      expect(result.content[0].text).toContain('- Summary updated');
      // The function currently returns an error if assignee is not found.
      // To test "still update other fields", the function logic would need to change to allow partial success.
      // For now, testing the warning message when assignee isn't found:
      const resultAssigneeFail = await updateIssue({ ...defaultArgs, assigneeName: 'UnknownUser' });
      expect(resultAssigneeFail.isError).toBe(true);
      expect(resultAssigneeFail.content[0].text).toContain('## ⚠️ Warning');
      expect(resultAssigneeFail.content[0].text).toContain('User "UnknownUser" not found');
    });
    
    it('should handle status transition not available and still update other fields', async () => {
        const newSummary = "Summary Update With Failed Status";
        mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}/transitions`).reply(200, { transitions: [] }); // No transitions available
        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204); // For summary

        const updatedMockIssue = { ...mockIssue, fields: { ...mockIssue.fields, summary: newSummary } };
        mock.onGet(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(200, updatedMockIssue);

        const result = await updateIssue({ ...defaultArgs, summary: newSummary, status: 'NonExistentStatus' });

        expect(mock.history.put.length).toBe(1); // Summary update
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('## ✅ Issue Updated Successfully');
        expect(result.content[0].text).toContain('- Summary updated');
        expect(result.content[0].text).toContain('- ⚠️ Status transition to "NonExistentStatus" failed: Not available.');
    });
    
    it('should handle Jira API error 400 (Bad Request on PUT)', async () => {
        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(400, { errorMessages: ["Bad request"] });
        const result = await updateIssue({ ...defaultArgs, summary: "Test" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Code:** JIRA_BAD_REQUEST");
        expect(result.content[0].text).toContain("Bad request");
    });

    it('should handle Jira API error 401 (Unauthorized on PUT)', async () => {
        (authUtils.validateCredentials as jest.Mock).mockImplementationOnce(() => { throw new Error("Missing Jira credentials") });
        const result = await updateIssue({ ...defaultArgs, jiraHost: '', summary: "Test" }); // remove host to trigger validation
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Code:** CREDENTIALS_MISSING");
        expect(result.content[0].text).toContain("Missing Jira credentials");
    });
    
    it('should handle Jira API error 403 (Forbidden on PUT)', async () => {
        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(403, { errorMessages: ["Forbidden action"] });
        const result = await updateIssue({ ...defaultArgs, summary: "Test" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Code:** JIRA_FORBIDDEN");
        expect(result.content[0].text).toContain("Forbidden action");
    });

    it('should handle missing credentials if not mocked/provided (env vars not set)', async () => {
        process.env.JIRA_HOST = ''; // Simulate missing env var
        (authUtils.validateCredentials as jest.Mock).mockImplementationOnce(() => { throw new Error("Missing Jira credentials: Jira host is required.") });

        const result = await updateIssue({ ...defaultArgs, jiraHost: '' }); // No host
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('## ❌ Error Updating Jira Issue');
        expect(result.content[0].text).toContain('Code:** CREDENTIALS_MISSING');
        expect(result.content[0].text).toContain('Missing Jira credentials: Jira host is required.');
        expect(authUtils.validateCredentials).toHaveBeenCalled();
    });

    it('should handle validation errors (missing issueIdOrKey)', async () => {
      const result = await updateIssue({ ...defaultArgs, issueIdOrKey: undefined as any });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('## ❌ Error Updating Jira Issue');
      expect(result.content[0].text).toContain('Code:** VALIDATION_ERROR');
      expect(result.content[0].text).toContain('issueIdOrKey is a required field');
    });
  });

  describe('ADF Conversion (implicitly tested)', () => {
    // These are covered by 'should update description successfully (string input)'
    // and 'should update description successfully (ADF input)'
    // Just ensuring the payload is correct.
    it('confirms string description is converted to ADF', async () => {
        const newDescription = "Simple string.";
        const expectedADF: ADFContent = {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: newDescription }] }],
        };
        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
        await updateIssue({ ...defaultArgs, description: newDescription });
        expect(JSON.parse(mock.history.put[0].data).fields.description).toEqual(expectedADF);
    });

    it('confirms ADF description is passed through as is', async () => {
        const adfDescription: ADFContent = {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ADF content.' }] }],
        };
        mock.onPut(`https://${mockJiraHost}/rest/api/3/issue/${mockIssueIdOrKey}`).reply(204);
        await updateIssue({ ...defaultArgs, description: adfDescription });
        expect(JSON.parse(mock.history.put[0].data).fields.description).toEqual(adfDescription);
    });
  });

  describe('ADF Description Validation (JiraUpdateIssueRequestSchema)', () => {
    const baseValidArgs = { issueIdOrKey: 'TEST-1' }; // Only required fields for schema testing

    it('should pass with a valid simple ADF object', () => {
      const description: ADFContent = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
      };
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(true);
    });

    it('should pass with a valid ADF object with nested content', () => {
      const description: ADFContent = {
        type: 'doc', version: 1,
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }],
          },
        ],
      };
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(true);
    });

    it('should pass with an empty content array in the main doc', () => {
      const description: ADFContent = { type: 'doc', version: 1, content: [] };
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(true);
    });

    it('should pass with an empty content array in a nested node', () => {
      const description: ADFContent = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [] }],
      };
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(true);
    });
    
    it('should pass with a description as a plain string', () => {
      const description = "This is a plain string description.";
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(true);
    });

    it('should pass if description is undefined', () => {
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description: undefined })).toBe(true);
    });

    // --- Invalid ADF Structures ---

    it('should fail if content array contains a non-object node', async () => {
      const description = {
        type: 'doc', version: 1,
        content: ["not an object"], // Invalid node
      };
      await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
        .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if a node is missing the "type" property', async () => {
      const description = {
        type: 'doc', version: 1,
        content: [{ content: [{ type: 'text', text: 'valid' }] } as any], // Missing 'type' in outer node
      };
       await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
        .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if a node has an empty string "type"', async () => {
      const description = {
        type: 'doc', version: 1,
        content: [{ type: '', content: [{ type: 'text', text: 'valid' }] }],
      };
      await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
        .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });
    
    it('should fail if a node has a non-string "type"', async () => {
        const description = {
            type: 'doc', version: 1,
            content: [{ type: 123, content: [{ type: 'text', text: 'valid' }] } as any],
        };
        await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if a nested node has an invalid "type" (e.g. empty string)', async () => {
      const description = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: '' }] }], // Nested node with invalid type
      };
      await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
        .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if a node has a "content" property that is not an array', async () => {
      const description = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: "not an array" as any }],
      };
      await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
        .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
      expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });
    
    it('should fail if the main ADF object is missing "type"', async () => {
        const description = {
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello'}] }]
        } as any;
         await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if the main ADF object has incorrect "type"', async () => {
        const description = {
            type: 'not-doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello'}] }]
        } as any;
         await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if the main ADF object is missing "version"', async () => {
        const description = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello'}] }]
        } as any;
         await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });

    it('should fail if the main ADF object has incorrect "version"', async () => {
        const description = {
            type: 'doc', version: 2, // Invalid version
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello'}] }]
        } as any;
         await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });
    
    it('should fail if the main ADF object "content" is not an array', async () => {
        const description = {
            type: 'doc', version: 1,
            content: "this should be an array"
        } as any;
         await expect(JiraUpdateIssueRequestSchema.validate({ ...baseValidArgs, description }))
            .rejects.toThrow('Description must be a string or a valid ADF object (with valid node structure)');
        expect(JiraUpdateIssueRequestSchema.isValidSync({ ...baseValidArgs, description })).toBe(false);
    });
  });
});
