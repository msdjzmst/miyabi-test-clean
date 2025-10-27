# Changelog

All notable changes to Miyabi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.6] - 2025-10-08

### Fixed
- **Issue #36**: Enhanced error logging for `.claude/` directory deployment
  - Added explicit error messages when templates not found
  - Added validation for empty file collection
  - Changed `spinner.warn` to `spinner.fail` for deployment errors
  - Show error stack trace in init command (first 3 lines)
  - Helps diagnose why `.claude/` deployment may fail

### Changed
- Improved error handling in `deployClaudeConfigToGitHub()`
- Better error visibility for template-related issues

## [0.4.5] - 2025-10-08

### Fixed
- **Issue #36**: Corrected `.claude/` directory deployment with POSIX path separator
  - Changed `path.join()` to `path.posix.join()` in `collectDirectoryFiles()`
  - Ensures consistent forward-slash paths for GitHub API across all platforms
  - Fixes issue where `.claude/` contents were not properly deployed to GitHub
  - Added debug logging to track file collection (shows collected file count and paths)

### Changed
- Cross-platform path handling for GitHub API interactions

## [0.4.4] - 2025-10-08

### Fixed
- Converted postinstall.js to ES modules
- Read version dynamically from package.json in postinstall script
- Fixed ESM import issues in postinstall flow

## [0.4.3] - 2025-10-08

### Added
- Comprehensive documentation files
  - `FOR_NON_PROGRAMMERS.md` - Complete guide for programming beginners
  - `INSTALL_TO_EXISTING_PROJECT.md` - Guide for adding Miyabi to existing projects
  - `EDGE_CASE_TESTS.md` - Edge case testing scenarios

### Fixed
- TypeScript compilation errors (7 errors resolved)
- Removed non-existent `@agentic-os/core` dependency (#33)

## [0.4.0] - 2025-10-08

### Added
- **Claude Code Integration**: Full `.claude/` directory deployment
  - 6 AI agents (CodeGenAgent, CoordinatorAgent, DeploymentAgent, IssueAgent, PRAgent, ReviewAgent)
  - 7 custom commands (/agent-run, /create-issue, /deploy, /generate-docs, /security-scan, /test, /verify)
  - MCP servers integration (github-enhanced, ide-integration, project-context)
  - Command hooks (log-commands.sh)
- `deployClaudeConfigToGitHub()` function for direct GitHub repository deployment
- `CLAUDE.md` template with project context

### Changed
- `miyabi init` now deploys `.claude/` configuration to GitHub before local cloning
- Enhanced setup flow with Claude Code configuration step

## [0.3.3] - 2025-10-08

### Added
- Post-install welcome flow for first-time users
- Environment checks (Node.js version, Git, GITHUB_TOKEN)
- Contextual next steps based on project status

### Changed
- Improved user onboarding experience with interactive setup guidance

## [0.1.5] - 2025-10-08

### Added
- **Sprint Management**: New `miyabi sprint start <sprint-name>` command for project sprint management
  - Interactive task planning with priorities (P0-P3) and types (feature, bug, etc.)
  - Automatic GitHub milestone creation with due dates
  - Batch issue creation linked to sprint milestone
  - Optional project structure initialization with `--init` flag
  - Dry-run mode support with `--dry-run` flag
- **Workflow Templates**: Added 13 GitHub Actions workflow templates
  - `auto-add-to-project.yml`
  - `autonomous-agent.yml`
  - `deploy-pages.yml`
  - `economic-circuit-breaker.yml`
  - `label-sync.yml`
  - `project-sync.yml`
  - `state-machine.yml`
  - `update-project-status.yml`
  - `webhook-event-router.yml`
  - `webhook-handler.yml`
  - `weekly-kpi-report.yml`
  - `weekly-report.yml`

### Fixed
- **Issue #29**: Fixed `__dirname is not defined` error in ESM context
  - Added proper ESM support in `src/setup/workflows.ts`
  - Implemented `fileURLToPath` and `import.meta.url` for path resolution
- **Missing Templates**: Fixed missing `templates/workflows/` directory
- **Error Messages**: Improved error messages with detailed path information in `src/setup/labels.ts`

### Changed
- Enhanced template path resolution with better error handling
- Updated documentation in README.md with sprint command usage examples

## [0.1.4] - 2025-10-08

### Added
- GitHub OAuth authentication with device flow
- Repository creation and setup
- Label system deployment (53 labels)
- Welcome issue creation

### Fixed
- Dynamic version loading from package.json
- TTY check for interactive mode compatibility

## [0.1.0] - 2025-10-07

### Added
- Initial release
- `init` command for new project creation
- `install` command for existing project integration
- `status` command for agent activity monitoring
- Interactive CLI mode with Japanese language support
- Zero-configuration setup philosophy
