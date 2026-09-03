# The Cartographer's Cabinet

A browser-based spatial worldbuilding workbench for people and WebMCP agents. Build hierarchical places, sketch plans, describe access rules, inspect routes and export maps. Work stays in the browser; the current editor needs no account, database server or model API key.

**Live application:** [cabinet.varera.studio](https://cabinet.varera.studio/)

Open `/` for the current editor. `/editor-v2/` remains an equivalent direct route for compatibility. This is a work in progress, not a claim that every workflow is finished or independently verified.

## Why WebMCP

Worldbuilding maps are more than pictures: their hierarchy, geometry, doors, access rules, characters and story state all affect one another. A general-purpose agent looking only at pixels cannot reliably understand or edit that system. The Cabinet exposes the same structured model and guarded operations used by the human editor through WebMCP. A person can therefore sketch and review visually while an agent reads context, checks consistency, proposes a multi-step change and applies it as one undoable transaction.

## Judge quickstart

1. Open the [live application](https://cabinet.varera.studio/) in a compatible WebMCP browser and agent host. No account or API key is required.
2. A fresh browser library opens **Residence of the Silver Lindens**, a synthetic estate with multiple levels, rooms, transitions, story entities, access rules and routes. The same fixture can be [downloaded directly](https://cabinet.varera.studio/examples/residence-of-the-silver-lindens.cartographer.json) and imported as a copy.
3. Ask the agent to call `inspect_editor_context`, `inspect_open_map` and `check_project_consistency` before changing anything.
4. Ask it to make one coherent spatial or story edit. Individual `prepare_*` tools return a preview token; `execute_editor_batch` can prepare or apply a group of supported edits atomically.
5. Review the visible change notice and result on the map. Undo the complete agent edit in one step, or redo it.

Human editing works without WebMCP. The agent steps require a host that exposes `document.modelContext`; the registration status in the page confirms browser registration, not that a particular host can call the tools.

## Run locally

Use Node.js **24.18.0** and pnpm **11.7.0**, recorded in `.node-version` and `package.json`.

```sh
npm exec --yes --package=pnpm@11.7.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.7.0 -- pnpm dev
```

Open the printed address. Choose English in the language control if the editor opens in Polish. No credentials or `.env` file are required.

## Verification and production build

```sh
npm exec --yes --package=pnpm@11.7.0 -- pnpm check
```

This checks file sizes, dead code, lint and TypeScript, runs the unit suite and builds the application. The release configuration creates a static site in `out/`, including the current editor routes, worker code and fonts. Serve **only `out/`**, never the repository directory. `next start` does not serve a static export.

For a local preview after building, run `pnpm start`. It serves only `out/` on
`127.0.0.1:3000` using `serve` 14.2.6; npm downloads that separate preview tool
on first use. Cloudflare Pages does not run this command. Alternatively, with Python 3:

```sh
python -m http.server 3107 --bind 127.0.0.1 --directory out
```

The current editor registers its real tools through the browser API required by the challenge. The implementation builds a typed catalogue and calls the following API for every tool:

```ts
document.modelContext.registerTool({
  ...tool,
  execute: async (input) => tool.execute(input),
});
```

See `src/editor-v2/webmcp/register-editor-tools.ts` and the related tool modules for the complete schemas, executors and safety flow.

The catalogue includes read-only inspection and consistency tools, guarded `prepare_*` commands for drawing and Story data, atomic batches, routes, checkpoints and project-library operations. The illustrative organizer snippet is kept separately in [the compliance notes](docs/hackathon-compliance.md); `search_products` is not a tool registered by this application.

## Data and privacy

Projects autosave in IndexedDB and can be exported/imported as versioned JSON. They are not uploaded to Cloudflare or Varéra. Export a backup before clearing browser data or changing domains. Domains, ports and browser profiles have separate project libraries; moving from localhost or `pages.dev` to a custom domain does not move saved projects automatically.

All included fixtures are synthetic. Private projects, user exports, local recordings, credentials, builds and private development history are excluded.

## Structure

- `src/editor-v2`: editor, geometry, persistence, story/access model, routes, exports and WebMCP.
- `src/app`: thin Next.js entry routes for the current editor.
- `public/fonts/gelasio`: bundled fonts and their SIL Open Font License.
- `docs/deployment.md`: Cloudflare Pages setup, domains and production acceptance checks.
- `docs/hackathon-compliance.md`: required registration, evidence and release obligations.

The application is a static Next.js export served by Cloudflare Pages. The React editor and WebMCP tools share one typed domain model and transaction layer; projects persist locally in IndexedDB and move between browsers through explicit JSON export/import. No backend receives project content.

## Known limitations

- Projects are local to one browser profile and origin; there is no account sync or collaborative server.
- WebMCP use depends on compatible experimental browser and agent-host support.
- A successful build verifies contracts and fixtures, but cannot certify every possible user-drawn geometry or external host integration.
- The static deployment has no server-side API, authentication or cloud project storage.

## Licensing

Original project code and visual assets are released under the MIT License; see `LICENSE` and `design-assets/README.md`. Dependencies and fonts retain their own licenses: see `THIRD_PARTY_NOTICES.md` and the license files beside each bundled font.
