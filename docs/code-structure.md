# Code structure and housekeeping

The codebase is organised by responsibility, not by whichever screen happened to need a function first.

## Boundaries

- `src/editor-v2/model`, `construction`, `geometry`, `roads` and `story` contain spatial rules, schemas and operations. They must not depend on a second legacy model.
- `src/editor-v2/state` owns reversible editor state; camera state never enters project geometry.
- `src/editor-v2/persistence` implements local project files, checkpoints and IndexedDB storage.
- `src/editor-v2/webmcp` exposes the same application operations to agents. It must not contain a second implementation of domain rules.
- `src/editor-v2/components` contains visual composition and interaction. Components delegate spatial reasoning and persistence.
- `src/editor-v2/i18n` and story message catalogs own user-visible application text.
- `src/editor-v2/export` renders the selected project context to SVG, PNG and vector PDF.
- `src/app` is the thin Next.js entry layer.

## Working rules

1. Delete replaced implementations in the same change that introduces their successor.
2. Do not keep commented-out alternatives or speculative abstractions.
3. Add a dependency only when the current increment uses it; remove it when its last consumer disappears.
4. Split a file at a natural responsibility boundary before it exceeds the automated size limit.
5. A feature is complete only after lint, types, tests and the production build pass.
6. Run `pnpm check:dead-code` regularly and before releases; investigate every reported unused file, export or dependency.

The line limits are guardrails, not a reason to compress code. Dense code that hides responsibilities should be split even when it technically passes.
