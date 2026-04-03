## ADDED Requirements
### Requirement: Biome Linting and Formatting
The project SHALL use Biome for code linting and formatting, replacing any existing linting/formatting tooling.

#### Scenario: Lint check passes
- **WHEN** the lint command is run
- **THEN** Biome analyzes all TypeScript/JavaScript/JSX/TSX files and reports no errors

#### Scenario: Format command
- **WHEN** the format command is run
- **THEN** Biome formats all code files according to the project's formatting rules

#### Scenario: Pre-commit lint check
- **WHEN** code is committed
- **THEN** a pre-commit hook runs Biome lint and blocks the commit if errors are found
