#!/bin/bash
# Automated PR creation script for ClawdBot_Tulsbot 2.0
# Usage: ./scripts/create-pr.sh [options]
#
# Options:
#   --title <title>        PR title (required if not inferred from commits)
#   --draft                Create as draft PR
#   --base <branch>        Base branch (default: main)
#   --auto-merge           Enable auto-merge when checks pass
#   --no-validate          Skip pre-push validations
#   --help                 Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
DRAFT=""
BASE_BRANCH="main"
AUTO_MERGE=false
SKIP_VALIDATION=false
PR_TITLE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --title)
      PR_TITLE="$2"
      shift 2
      ;;
    --draft)
      DRAFT="--draft"
      shift
      ;;
    --base)
      BASE_BRANCH="$2"
      shift 2
      ;;
    --auto-merge)
      AUTO_MERGE=true
      shift
      ;;
    --no-validate)
      SKIP_VALIDATION=true
      shift
      ;;
    --help)
      echo "Usage: ./scripts/create-pr.sh [options]"
      echo ""
      echo "Options:"
      echo "  --title <title>        PR title (required if not inferred from commits)"
      echo "  --draft                Create as draft PR"
      echo "  --base <branch>        Base branch (default: main)"
      echo "  --auto-merge           Enable auto-merge when checks pass"
      echo "  --no-validate          Skip pre-push validations"
      echo "  --help                 Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Run with --help for usage information"
      exit 1
      ;;
  esac
done

# Check if gh CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
  echo "Install it with: brew install gh"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI is not authenticated${NC}"
  echo "Authenticate with: gh auth login"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

if [ -z "$CURRENT_BRANCH" ]; then
  echo -e "${RED}❌ Not on a branch (detached HEAD state)${NC}"
  exit 1
fi

if [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
  echo -e "${RED}❌ Cannot create PR from $BASE_BRANCH branch${NC}"
  echo "Create a feature branch first: git checkout -b feature/your-feature"
  exit 1
fi

echo -e "${BLUE}📝 Creating PR from branch: $CURRENT_BRANCH${NC}"

# Check if remote branch exists
if ! git ls-remote --heads origin "$CURRENT_BRANCH" | grep -q "$CURRENT_BRANCH"; then
  echo -e "${YELLOW}⚠️  Remote branch does not exist. Pushing...${NC}"
  git push -u origin "$CURRENT_BRANCH"
fi

# Run pre-push validations unless skipped
if [ "$SKIP_VALIDATION" = false ]; then
  echo -e "${BLUE}🔍 Running pre-push validations...${NC}"
  if [ -x "./git-hooks/pre-push" ]; then
    if ! ./git-hooks/pre-push; then
      echo -e "${RED}❌ Pre-push validations failed${NC}"
      echo "Fix the issues above or use --no-validate to skip (not recommended)"
      exit 1
    fi
  else
    echo -e "${YELLOW}⚠️  Pre-push hook not found or not executable, skipping validation${NC}"
  fi
fi

# Infer PR title from commits if not provided
if [ -z "$PR_TITLE" ]; then
  # Get the most recent commit message
  RECENT_COMMIT=$(git log -1 --pretty=format:"%s")

  # Try to extract a meaningful title from commit message
  # Remove conventional commit prefix for title
  PR_TITLE=$(echo "$RECENT_COMMIT" | sed -E 's/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: //')

  # Capitalize first letter
  PR_TITLE="$(echo "${PR_TITLE:0:1}" | tr '[:lower:]' '[:upper:]')${PR_TITLE:1}"

  echo -e "${YELLOW}📋 Inferred PR title: $PR_TITLE${NC}"
  echo -e "${YELLOW}   (use --title to override)${NC}"
fi

# Create the PR
echo -e "${BLUE}🚀 Creating pull request...${NC}"

PR_URL=$(gh pr create \
  --base "$BASE_BRANCH" \
  --head "$CURRENT_BRANCH" \
  --title "$PR_TITLE" \
  --fill \
  $DRAFT)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Pull request created successfully!${NC}"
  echo -e "${GREEN}   URL: $PR_URL${NC}"

  # Enable auto-merge if requested
  if [ "$AUTO_MERGE" = true ]; then
    echo -e "${BLUE}🔄 Enabling auto-merge...${NC}"

    # Extract PR number from URL
    PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

    if gh pr merge "$PR_NUMBER" --auto --squash &> /dev/null; then
      echo -e "${GREEN}✅ Auto-merge enabled (squash mode)${NC}"
      echo -e "${YELLOW}   PR will be merged automatically when all checks pass${NC}"
    else
      echo -e "${YELLOW}⚠️  Could not enable auto-merge (may require admin permissions)${NC}"
    fi
  fi

  # Open PR in browser
  echo -e "${BLUE}🌐 Opening PR in browser...${NC}"
  gh pr view "$PR_URL" --web

else
  echo -e "${RED}❌ Failed to create pull request${NC}"
  exit 1
fi

exit 0
