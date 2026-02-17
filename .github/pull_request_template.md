# Pull Request

## Description

<!-- Provide a clear and concise description of what this PR does -->

## Type of Change

<!-- Mark the relevant option(s) with an 'x' -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style/formatting update
- [ ] ♻️ Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test updates
- [ ] 🔧 Configuration changes
- [ ] 🏗️ Infrastructure/build changes

## Quality Checklist

<!-- All items must be checked before merge -->

- [ ] ✅ All tests pass locally (`pnpm test`)
- [ ] 🔍 Lint passes (`pnpm lint`)
- [ ] 💅 Format check passes (`pnpm format:check`)
- [ ] 📋 Types check passes (`pnpm tsgo`)
- [ ] 🧪 Added/updated tests for new functionality
- [ ] 📖 Updated relevant documentation
- [ ] 🔄 No merge conflicts with `main`
- [ ] 📝 Follows [conventional commits](https://www.conventionalcommits.org/) format

## Testing Performed

<!-- Describe the testing you've done -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Manual testing completed

**Test Details**:

<!-- Describe specific test scenarios covered -->

## Documentation Updates

<!-- List any documentation changes -->

- [ ] Code comments added/updated
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] Migration guide added (for breaking changes)

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**None** / **Details below**:

## Related Issues

<!-- Link to related issues using GitHub keywords: Fixes #123, Closes #456, Related to #789 -->

## Additional Context

<!-- Add any other context about the PR here -->

## Screenshots/Videos

<!-- If applicable, add screenshots or videos demonstrating the changes -->

---

**For Reviewers**: This PR follows the multi-agent deployment strategy outlined in REBUILD-PLAN.md. CI checks are comprehensive and include:

- ✅ Node + Bun test suites
- ✅ Type checking, linting, formatting
- ✅ Protocol validation
- ✅ Docs validation (if docs changed)
- ✅ Secret scanning
- ✅ Windows/macOS/Android builds (scope-dependent)
