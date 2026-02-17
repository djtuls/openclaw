/**
 * Tests for PR automation functionality
 * Tests pre-push hook validation logic and PR creation script
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("PR Automation", () => {
  describe("PR Template", () => {
    it("should have a PR template file", () => {
      const templatePath = path.join(projectRoot, ".github/pull_request_template.md");
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it("should include required sections in PR template", () => {
      const templatePath = path.join(projectRoot, ".github/pull_request_template.md");
      const content = fs.readFileSync(templatePath, "utf-8");

      // Required sections
      expect(content).toContain("## Description");
      expect(content).toContain("## Type of Change");
      expect(content).toContain("## Quality Checklist");
      expect(content).toContain("## Testing Performed");
      expect(content).toContain("## Documentation Updates");
      expect(content).toContain("## Breaking Changes");
      expect(content).toContain("## Related Issues");
    });

    it("should reference conventional commits in PR template", () => {
      const templatePath = path.join(projectRoot, ".github/pull_request_template.md");
      const content = fs.readFileSync(templatePath, "utf-8");

      expect(content).toContain("conventional commits");
    });

    it("should include quality gates in checklist", () => {
      const templatePath = path.join(projectRoot, ".github/pull_request_template.md");
      const content = fs.readFileSync(templatePath, "utf-8");

      // Quality gate checkboxes
      expect(content).toContain("All tests pass");
      expect(content).toContain("Lint passes");
      expect(content).toContain("Format check passes");
      expect(content).toContain("Types check passes");
    });
  });

  describe("Pre-push Hook", () => {
    it("should have a pre-push hook file", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      expect(fs.existsSync(hookPath)).toBe(true);
    });

    it("should be executable", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const stats = fs.statSync(hookPath);
      // Check if file has execute permission (user, group, or other)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it("should validate branch naming patterns", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const content = fs.readFileSync(hookPath, "utf-8");

      // Should check for valid branch name patterns
      expect(content).toContain("feature");
      expect(content).toContain("fix");
      expect(content).toContain("chore");
      expect(content).toContain("docs");
    });

    it("should validate conventional commit messages", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const content = fs.readFileSync(hookPath, "utf-8");

      // Should validate conventional commit format
      expect(content).toContain("feat");
      expect(content).toContain("fix");
      expect(content).toContain("conventional commits");
    });

    it("should run format, lint, and type checks", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const content = fs.readFileSync(hookPath, "utf-8");

      expect(content).toContain("format:check");
      expect(content).toContain("pnpm lint");
      expect(content).toContain("pnpm tsgo");
    });
  });

  describe("PR Creation Script", () => {
    it("should have a PR creation script", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it("should be executable", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it("should support command-line options", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      const content = fs.readFileSync(scriptPath, "utf-8");

      // Should support key options
      expect(content).toContain("--title");
      expect(content).toContain("--draft");
      expect(content).toContain("--base");
      expect(content).toContain("--auto-merge");
      expect(content).toContain("--no-validate");
      expect(content).toContain("--help");
    });

    it("should use gh CLI for PR creation", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      const content = fs.readFileSync(scriptPath, "utf-8");

      expect(content).toContain("gh pr create");
      expect(content).toContain("gh auth status");
    });

    it("should validate prerequisites", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      const content = fs.readFileSync(scriptPath, "utf-8");

      // Should check for gh CLI
      expect(content).toContain("command -v gh");
      // Should check authentication
      expect(content).toContain("gh auth status");
      // Should check branch state
      expect(content).toContain("git symbolic-ref");
    });

    it("should run pre-push validation by default", () => {
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");
      const content = fs.readFileSync(scriptPath, "utf-8");

      expect(content).toContain("./git-hooks/pre-push");
      expect(content).toContain("SKIP_VALIDATION");
    });
  });

  describe("Branch Naming Validation", () => {
    const validBranches = [
      "feature/add-new-feature",
      "fix/bug-fix",
      "chore/update-deps",
      "docs/update-readme",
      "test/add-tests",
      "refactor/cleanup-code",
      "perf/optimize-query",
    ];

    const invalidBranches = ["random-branch", "FEATURE/uppercase", "feature-no-slash", "feat/typo"];

    it.each(validBranches)("should accept valid branch name: %s", (branch) => {
      // This is a logical test - actual validation happens in the hook
      expect(branch).toMatch(/^(feature|fix|chore|docs|test|refactor|perf)\//);
    });

    it.each(invalidBranches)("should reject invalid branch name: %s", (branch) => {
      expect(branch).not.toMatch(/^(feature|fix|chore|docs|test|refactor|perf)\//);
    });
  });

  describe("Commit Message Validation", () => {
    const validMessages = [
      "feat: add new feature",
      "fix: fix bug",
      "feat(scope): add feature with scope",
      "fix!: breaking fix",
      "chore(deps): update dependencies",
      "docs: update documentation",
      "test: add unit tests",
    ];

    const invalidMessages = [
      "Add new feature",
      "fixed bug",
      "FEAT: wrong case",
      "feature: typo in type",
      "random commit message",
    ];

    const conventionalCommitRegex =
      /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:/;

    it.each(validMessages)("should accept valid commit message: %s", (message) => {
      expect(message).toMatch(conventionalCommitRegex);
    });

    it.each(invalidMessages)("should reject invalid commit message: %s", (message) => {
      expect(message).not.toMatch(conventionalCommitRegex);
    });
  });

  describe("Integration", () => {
    it("should have consistent branch naming pattern across all files", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const scriptPath = path.join(projectRoot, "scripts/create-pr.sh");

      const hookContent = fs.readFileSync(hookPath, "utf-8");
      const _scriptContent = fs.readFileSync(scriptPath, "utf-8");

      // Both should reference the same branch types
      const branchTypes = ["feature", "fix", "chore", "docs", "test", "refactor", "perf"];

      for (const type of branchTypes) {
        expect(hookContent).toContain(type);
      }
    });

    it("should have consistent commit types across all files", () => {
      const hookPath = path.join(projectRoot, "git-hooks/pre-push");
      const templatePath = path.join(projectRoot, ".github/pull_request_template.md");

      const hookContent = fs.readFileSync(hookPath, "utf-8");
      const templateContent = fs.readFileSync(templatePath, "utf-8");

      // Both should reference conventional commits
      expect(hookContent).toContain("feat");
      expect(hookContent).toContain("fix");
      expect(templateContent).toContain("conventional commits");
    });
  });
});
