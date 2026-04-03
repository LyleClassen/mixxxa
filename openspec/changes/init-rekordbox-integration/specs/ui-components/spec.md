## ADDED Requirements
### Requirement: shadcn BaseUI Integration
The project SHALL use shadcn BaseUI components as the primary UI primitive library, styled with the existing Tailwind CSS configuration.

#### Scenario: BaseUI components available
- **WHEN** a developer imports from the BaseUI component library
- **THEN** Table, Button, Dialog, and Input components are available for use

#### Scenario: Components styled with Tailwind
- **WHEN** BaseUI components are rendered
- **THEN** they are styled using Tailwind CSS utility classes consistent with the project's design tokens
