# DezTehUg Project Memory Bank Instructions

## Purpose and Goals

The DezTehUg project memory bank is designed for centralized storage and management of project knowledge. Main goals:

- **Context preservation** - recording important decisions, architectural choices and business logic
- **Development acceleration** - quick access to project structure and component information
- **Continuity assurance** - knowledge transfer between developers and sessions
- **Quality control** - tracking changes and maintaining documentation relevance

## Memory Bank Structure

### Main Files

1. **[`brief.md`](.kilocode/rules/memory-bank/brief.md)** - Project brief (1-2 pages)
   - Project overview and purpose
   - Key features and technologies
   - Current development status
   - Priority tasks

2. **[`project-memory.md`](.kilocode/rules/memory-bank/project-memory.md)** - Full project documentation
   - Detailed architecture and structure
   - Components and their relationships
   - Design system and standards
   - Change history and decisions

3. **[`memory-bank-instructions.md`](.kilocode/rules/memory-bank/memory-bank-instructions.md)** - This instruction file

## Documentation Rules

### 1. Documentation Principles

- **Relevance** - documentation must reflect current project state
- **Completeness** - all key components and decisions must be documented
- **Structure** - information organized logically and easily findable
- **Readability** - documentation written in clear language with examples

### 2. Formatting Standards

#### Headers and Structure
```markdown
# Main Header (H1) - only one per file
## Section (H2) - main sections
### Subsection (H3) - section details
#### Item (H4) - specific elements
```

#### File Links
- Use relative paths: [`filename.ext`](path/to/filename.ext)
- For components: [`ComponentName`](components/path/ComponentName.tsx)
- For configuration: [`config.json`](config.json)

#### Code Blocks
```typescript
// Use appropriate language for syntax highlighting
interface ExampleInterface {
  property: string;
}
```

#### Lists and Enumerations
- **Bold text** for important terms
- `Inline code` for filenames, commands, variables
- Numbered lists for sequential actions
- Bullet lists for enumerations

### 3. Required Sections

#### In brief.md:
- Project overview (1-2 paragraphs)
- Key features (5-7 points)
- Tech stack (brief)
- Current status
- Priority tasks

#### In project-memory.md:
- Project overview
- Project structure
- Key components
- Design system
- Current state
- Important files
- Development plans
- Update procedures (new section)

## Update Procedures

### 1. Regular Updates

#### Daily (during active development):
- Update "Current state" section
- Record new components and files
- Update task lists in development

#### Weekly:
- Review project structure
- Update development plans
- Check link relevance

#### On significant changes:
- Update architectural decisions
- Document new patterns
- Review design system

### 2. Update Triggers

Documentation should be updated when:
- Adding new components
- Changing project structure
- Updating dependencies
- Changing design system
- Making architectural decisions
- Completing major tasks

### 3. Update Process

1. **Change Analysis**
   - Determine which sections require updates
   - Check existing information relevance

2. **Documentation Update**
   - Make changes to appropriate sections
   - Update timestamps
   - Check link correctness

3. **Validation**
   - Ensure new information correctness
   - Check formatting standards compliance
   - Test file links

## Quality Control

### 1. Documentation Quality Criteria

- **Relevance** - information matches current state
- **Completeness** - all important project aspects covered
- **Accuracy** - no errors or inaccuracies
- **Consistency** - unified style and terminology
- **Navigation** - easy to find needed information

### 2. Review Checklist

#### Structure and Formatting:
- [ ] Headers structured logically
- [ ] Unified formatting style used
- [ ] File links are correct
- [ ] Code blocks have proper syntax highlighting

#### Content:
- [ ] Information is current
- [ ] All new components documented
- [ ] Architectural decisions explained
- [ ] Timestamps updated

#### Navigation:
- [ ] Table of contents matches content
- [ ] Cross-section links work
- [ ] Easy to find needed information

### 3. Review Procedure

#### Weekly Review:
1. Check relevance of all sections
2. Validate file links
3. Update statistics and metrics
4. Check standards compliance

#### Monthly Review:
1. Full documentation structure audit
2. Navigation optimization
3. Update procedures and standards
4. Archive outdated information

## Versioning and Change History

### 1. Versioning System

- **Major changes** (1.0.0 → 2.0.0) - fundamental architecture changes
- **Minor changes** (1.0.0 → 1.1.0) - adding new components/functions
- **Patches** (1.0.0 → 1.0.1) - fixes and minor updates

### 2. Recording Changes

#### Change Record Format:
```markdown
### [Version] - YYYY-MM-DD

#### Added
- New components or functions

#### Changed
- Modifications to existing elements

#### Fixed
- Fixed errors and inaccuracies

#### Removed
- Removed components or functions
```

### 3. Document Metadata

Each file should contain at the end:
```markdown
---

*Last updated: DD Month YYYY, HH:MM (UTC+3)*
*Documentation version: X.Y.Z*
*Project status: [Active development/Stable version/Support]*
*Responsible: [Developer name]*
```

## Workflow Integration

### 1. Development Integration

- **When creating component** - add description to appropriate section
- **When changing architecture** - update diagrams and descriptions
- **When completing task** - update status in development plans
- **When finding issue** - record in known issues section

### 2. Planning Usage

- Memory bank as source for task planning
- Technical debt analysis based on documentation
- Task complexity assessment considering existing architecture

### 3. Team Communication

- Memory bank as single source of truth about project
- Documentation links in discussions
- Usage during new member onboarding

## DezTehUg Project Specifics

### 1. Documentation Features

- **Cyberpunk design** - detailed design system and color palette description
- **Component architecture** - documenting all custom components
- **Typing** - recording TypeScript interfaces and types
- **SEO structure** - documenting SEO data and metadata

### 2. Key Aspects to Track

- Icon system state
- Cyberpunk component development
- Business logic service integration
- Performance and optimization
- Component testing

### 3. Special Procedures

- **Test files** - documenting test-*.html file purposes
- **Icons** - tracking SVG icon creation and usage
- **Design system** - recording cyberpunk style changes
- **Service data** - syncing with data/ directory changes

## Conclusion

The DezTehUg project memory bank is a living document that should evolve with the project. Following these instructions ensures high documentation quality and development efficiency.

Remember: good documentation is an investment in the project's and team's future.

---

*Last updated: January 9, 2025, 2:41 PM (UTC+3)*
*Instructions version: 1.0.1*
*Status: Active document*