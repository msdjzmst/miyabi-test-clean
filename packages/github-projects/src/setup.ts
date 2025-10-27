/**
 * GitHub Project V2 Setup Utilities
 *
 * Tools for creating and configuring new GitHub Projects V2
 *
 * Issue #5 Phase A: Data Persistence Layer
 */

import { graphql } from '@octokit/graphql';

// ============================================================================
// Types
// ============================================================================

interface ProjectSetupConfig {
  owner: string;
  title: string;
  description: string;
}

interface CustomFieldConfig {
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
  options?: string[];
}

// ============================================================================
// GitHub Project Setup
// ============================================================================

export class GitHubProjectSetup {
  private graphqlClient: typeof graphql;

  constructor(token: string) {
    this.graphqlClient = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
  }

  /**
   * Create a new GitHub Project V2
   */
  async createProject(config: ProjectSetupConfig): Promise<{
    projectId: string;
    projectNumber: number;
    url: string;
  }> {
    const mutation = `
      mutation($ownerId: ID!, $title: String!, $description: String!) {
        createProjectV2(input: {
          ownerId: $ownerId
          title: $title
          description: $description
        }) {
          projectV2 {
            id
            number
            title
            url
          }
        }
      }
    `;

    try {
      // First, get the owner's ID
      const ownerQuery = `
        query($login: String!) {
          user(login: $login) {
            id
          }
        }
      `;

      const ownerResult: any = await this.graphqlClient(ownerQuery, {
        login: config.owner,
      });

      const ownerId = ownerResult.user.id;

      // Create the project
      const result: any = await this.graphqlClient(mutation, {
        ownerId,
        title: config.title,
        description: config.description,
      });

      const project = result.createProjectV2.projectV2;
      console.log('✅ Project created successfully!');
      console.log(`   ID: ${project.id}`);
      console.log(`   Number: ${project.number}`);
      console.log(`   Title: ${project.title}`);
      console.log(`   URL: ${project.url}`);

      return {
        projectId: project.id,
        projectNumber: project.number,
        url: project.url,
      };
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Add custom field to project
   */
  async addCustomField(
    projectId: string,
    field: CustomFieldConfig
  ): Promise<string> {
    let mutation = '';
    let variables: any = {
      projectId,
      name: field.name,
    };

    switch (field.dataType) {
      case 'TEXT':
        mutation = `
          mutation($projectId: ID!, $name: String!) {
            createProjectV2Field(input: {
              projectId: $projectId
              dataType: TEXT
              name: $name
            }) {
              projectV2Field {
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        `;
        break;

      case 'NUMBER':
        mutation = `
          mutation($projectId: ID!, $name: String!) {
            createProjectV2Field(input: {
              projectId: $projectId
              dataType: NUMBER
              name: $name
            }) {
              projectV2Field {
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        `;
        break;

      case 'DATE':
        mutation = `
          mutation($projectId: ID!, $name: String!) {
            createProjectV2Field(input: {
              projectId: $projectId
              dataType: DATE
              name: $name
            }) {
              projectV2Field {
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        `;
        break;

      case 'SINGLE_SELECT':
        if (!field.options || field.options.length === 0) {
          throw new Error('SINGLE_SELECT field requires options');
        }

        mutation = `
          mutation($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
            createProjectV2Field(input: {
              projectId: $projectId
              dataType: SINGLE_SELECT
              name: $name
              singleSelectOptions: $options
            }) {
              projectV2Field {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        `;

        variables.options = field.options.map((option) => ({
          name: option,
          color: this.getColorForOption(option),
          description: '',
        }));
        break;

      case 'ITERATION':
        mutation = `
          mutation($projectId: ID!, $name: String!) {
            createProjectV2Field(input: {
              projectId: $projectId
              dataType: ITERATION
              name: $name
            }) {
              projectV2Field {
                ... on ProjectV2IterationField {
                  id
                  name
                }
              }
            }
          }
        `;
        break;

      default:
        throw new Error(`Unsupported field type: ${field.dataType}`);
    }

    try {
      const result: any = await this.graphqlClient(mutation, variables);
      const fieldData = result.createProjectV2Field.projectV2Field;

      console.log(`✅ Added field: ${fieldData.name} (${field.dataType})`);
      return fieldData.id;
    } catch (error) {
      console.error(`❌ Failed to add field ${field.name}:`, error);
      throw error;
    }
  }

  /**
   * Setup complete project with all custom fields
   */
  async setupCompleteProject(
    owner: string,
    projectTitle: string
  ): Promise<{ projectId: string; projectNumber: number; url: string }> {
    console.log('🚀 Starting GitHub Project V2 setup...\n');

    // Step 1: Create project
    console.log('Step 1: Creating project...');
    const { projectId, projectNumber, url } = await this.createProject({
      owner,
      title: projectTitle,
      description:
        'Agentic OS: Autonomous Agent Development System - Track agent performance, costs, and quality metrics',
    });

    console.log('\n⏳ Waiting 2 seconds for project initialization...');
    await this.sleep(2000);

    // Step 2: Add custom fields
    console.log('\nStep 2: Adding custom fields...');

    const fields: CustomFieldConfig[] = [
      {
        name: 'Agent',
        dataType: 'SINGLE_SELECT',
        options: ['CodeGen', 'Review', 'Deploy', 'Coordinator', 'TechLead'],
      },
      {
        name: 'Duration',
        dataType: 'NUMBER',
      },
      {
        name: 'Cost',
        dataType: 'NUMBER',
      },
      {
        name: 'Quality Score',
        dataType: 'NUMBER',
      },
      {
        name: 'Sprint',
        dataType: 'ITERATION',
      },
    ];

    for (const field of fields) {
      await this.addCustomField(projectId, field);
      await this.sleep(1000); // Rate limiting
    }

    console.log('\n✅ Project setup complete!');
    console.log(`\n📊 Project Details:`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Number: ${projectNumber}`);
    console.log(`   ID: ${projectId}`);
    console.log(`   URL: ${url}`);

    console.log('\n💡 Next Steps:');
    console.log(`   1. Update .env with: PROJECT_NUMBER=${projectNumber}`);
    console.log('   2. Update workflow files with the correct project URL');
    console.log('   3. Run: npm run project:info');

    return { projectId, projectNumber, url };
  }

  /**
   * Get color for single select option
   */
  private getColorForOption(option: string): string {
    const colorMap: Record<string, string> = {
      CodeGen: 'BLUE',
      Review: 'GREEN',
      Deploy: 'PURPLE',
      Coordinator: 'YELLOW',
      TechLead: 'RED',
      'In Progress': 'YELLOW',
      'In Review': 'BLUE',
      Done: 'GREEN',
      Cancelled: 'RED',
      Pending: 'GRAY',
    };

    return colorMap[option] || 'GRAY';
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
