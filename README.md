# Jira MCP Server

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Jira](https://img.shields.io/badge/Jira-0052CC?style=for-the-badge&logo=jira&logoColor=white)](https://www.atlassian.com/software/jira)
[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)

</div>

A Model Context Protocol (MCP) server for Jira integration. This server allows AI assistants like Claude to interact with Jira using MCP.

<div align="center">
  <img src="https://skillicons.dev/icons?i=ts,nodejs,git" alt="Skills" />
</div>

**Author:** Samuel Rizzo

<div align="center">

[![GitHub followers](https://img.shields.io/github/followers/samuelrizzo?style=social)](https://github.com/samuelrizzo)
[![Twitter Follow](https://img.shields.io/twitter/follow/rizzo_exe?style=social)](https://twitter.com/rizzo_exe)

</div>

## Features

- List all Jira projects
- Get detailed issue information
- Search issues by project and assignee
- List project members
- Check user's project membership and assigned issues

## Installation

```bash
# Clone the repository
git clone https://github.com/samuelrizzo/jira-mcp-server.git
cd jira-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### MCP Server Configuration

Add the following configuration to your cursor/windsurf mcp settings file:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "JIRA_HOST": "your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### Setting up API Access

1. Generate a Jira API token:

   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click "Create API Token"
   - Give it a name and click "Create"
   - Copy the token (you'll need it for authentication)

2. Note your Jira host URL (e.g., `your-domain.atlassian.net`) and email address associated with your Atlassian account.
3. Add these credentials to your MCP server configuration.

## Available Tools

### 1. List Projects (`mcp_jira_list_projects`)

Lists all Jira projects the authenticated user has access to.

**Parameters:**

- `jiraHost`: Your Jira domain (e.g., 'your-domain.atlassian.net')
- `email`: Your Jira email
- `apiToken`: Your Jira API token

### 2. Get Issue Details (`mcp_jira_get_issue`)

Retrieves detailed information about a specific Jira issue.

**Parameters:**

- `issueKey`: The Jira issue key (e.g., 'PROJECT-123')
- `jiraHost`: Your Jira domain
- `email`: Your Jira email
- `apiToken`: Your Jira API token

### 3. Search Issues (`mcp_jira_search_issues`)

Searches for issues in a specific project, optionally filtered by assignee.

**Parameters:**

- `projectKey`: The Jira project key
- `assigneeName`: (Optional) Filter issues by assignee name
- `jiraHost`: Your Jira domain
- `email`: Your Jira email
- `apiToken`: Your Jira API token

### 4. List Project Members (`mcp_jira_list_project_members`)

Lists all members of a specific Jira project.

**Parameters:**

- `projectKey`: The Jira project key
- `jiraHost`: Your Jira domain
- `email`: Your Jira email
- `apiToken`: Your Jira API token

### 5. Check User Issues (`mcp_jira_check_user_issues`)

Checks if a user is a member of a project and lists their assigned issues.

**Parameters:**

- `projectKey`: The Jira project key
- `userName`: The display name of the user to check
- `jiraHost`: Your Jira domain
- `email`: Your Jira email
- `apiToken`: Your Jira API token

## Usage Examples

Here are some example queries you can use with Claude:

```
"List all Jira projects in PROJECT"
"Get details for issue PROJECT-123"
"Search for issues assigned to John in PROJECT"
"List all members of PROJECT"
"Check what issues are assigned to Jane in PROJECT"
```

## Continuous Development

This project is under active development. New tools and features are being added regularly to expand the integration capabilities with Jira. Future updates will include:

- Additional issue management tools
- Sprint and board management
- Advanced search and filtering options
- Custom field handling
- Workflow transitions
- And more!

Stay tuned by watching or starring the repository for updates.

## Contributing

This is an open-source project and contributions are welcome! To contribute:

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Submit a pull request

## Open Source

This code is completely open source. You are free to:

- Copy
- Modify
- Distribute
- Use commercially
- Use privately

No restrictions - do whatever you want with the code!

## License

MIT
