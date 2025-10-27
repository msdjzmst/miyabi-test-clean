/**
 * Projects GraphQL API - Re-export for backward compatibility
 *
 * This file re-exports all functions from the github/projects-graphql.ts module
 * to maintain compatibility with existing import paths.
 */

export {
  getProjectInfo,
  addItemToProject,
  updateProjectField,
  updateSingleSelectField,
  getProjectItems,
  generateWeeklyReport,
} from './github/projects-graphql.js';
