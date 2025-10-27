/**
 * GitHub Projects V2 setup module
 *
 * Creates and configures GitHub Projects V2 for agent tracking
 */

import { graphql } from '@octokit/graphql';

interface ProjectV2 {
  id: string;
  url: string;
  number: number;
}

/**
 * Create a new GitHub Projects V2 and link repository
 */
export async function createProjectV2(
  owner: string,
  repo: string,
  token: string
): Promise<ProjectV2> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  // Step 1: Get owner ID (user or org)
  const ownerData: any = await graphqlWithAuth(
    `
    query($login: String!) {
      user(login: $login) {
        id
      }
      organization(login: $login) {
        id
      }
    }
  `,
    { login: owner }
  );

  const ownerId = ownerData.user?.id || ownerData.organization?.id;

  if (!ownerId) {
    throw new Error(`Could not find owner: ${owner}`);
  }

  // Step 2: Create Projects V2
  const createResult: any = await graphqlWithAuth(
    `
    mutation($ownerId: ID!, $title: String!) {
      createProjectV2(input: { ownerId: $ownerId, title: $title }) {
        projectV2 {
          id
          url
          number
        }
      }
    }
  `,
    {
      ownerId,
      title: `${repo} - Agentic OS`,
    }
  );

  const project = createResult.createProjectV2.projectV2;

  // Step 3: Add custom fields (Agent, Duration, Cost, Quality)
  await addCustomFields(graphqlWithAuth, project.id);

  return project;
}

/**
 * Link existing repository to existing Projects V2
 */
export async function linkToProject(
  _owner: string,
  _repo: string,
  _token: string
): Promise<void> {
  // This is handled automatically by the project-sync.yml workflow
  // No manual linking needed
  console.log('Projects V2 will auto-sync via workflow');
}

/**
 * Add custom fields to Projects V2
 */
async function addCustomFields(
  graphqlWithAuth: typeof graphql,
  projectId: string
): Promise<void> {
  // Field 1: Agent (Single Select)
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: $dataType
        name: $name
        singleSelectOptions: [
          { name: "CoordinatorAgent", color: "PINK" }
          { name: "CodeGenAgent", color: "BLUE" }
          { name: "ReviewAgent", color: "GREEN" }
          { name: "IssueAgent", color: "PURPLE" }
          { name: "PRAgent", color: "ORANGE" }
          { name: "DeploymentAgent", color: "RED" }
        ]
      }) {
        projectV2Field {
          id
        }
      }
    }
  `,
    {
      projectId,
      name: 'Agent',
      dataType: 'SINGLE_SELECT',
    }
  );

  // Field 2: Duration (Number)
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: $dataType
        name: $name
      }) {
        projectV2Field {
          id
        }
      }
    }
  `,
    {
      projectId,
      name: 'Duration (min)',
      dataType: 'NUMBER',
    }
  );

  // Field 3: Cost (Number)
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: $dataType
        name: $name
      }) {
        projectV2Field {
          id
        }
      }
    }
  `,
    {
      projectId,
      name: 'Cost ($)',
      dataType: 'NUMBER',
    }
  );

  // Field 4: Quality Score (Number)
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: $dataType
        name: $name
      }) {
        projectV2Field {
          id
        }
      }
    }
  `,
    {
      projectId,
      name: 'Quality Score',
      dataType: 'NUMBER',
    }
  );
}
