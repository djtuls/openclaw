# Visualizations

Architecture diagrams, mind maps, and dependency graphs generated from NotebookLM.

## Purpose

Agents should check this directory **before crawling source files** to understand project architecture. These visualizations provide a high-level overview without consuming tokens on file-by-file inspection.

## Contents

- Architecture diagrams (Mermaid format)
- Module dependency graphs
- Channel routing flow diagrams
- Mind maps of project concepts

## Regenerating

Query the NotebookLM master notebook for updated visualizations:

```sh
nlm query "$NLM_MASTER_NOTEBOOK_ID" "Generate a Mermaid diagram of <topic>"
```

Save the output here as a `.md` file and commit it.

## Related

- Notebook registry: `.agents/skills/notebooklm/references/notebook-registry.md`
- Codebase sync: `scripts/nlm-sync-codebase.sh`
- NotebookLM skill: `.agents/skills/notebooklm/SKILL.md`
