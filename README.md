# The Cartographer's Cabinet

A browser-based spatial worldbuilding workbench for people and WebMCP agents. Build hierarchical places, sketch plans, describe access rules, inspect routes and export maps. Work stays in the browser; the current editor needs no account, database server or model API key.

**Live application:** [cabinet.varera.studio](https://cabinet.varera.studio/)

Open `/` for the current editor. `/editor-v2/` remains an equivalent direct route for compatibility. This is a work in progress, not a claim that every workflow is finished or independently verified.

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

Human editing works without WebMCP. Agent tools additionally require a compatible browser and agent host that exposes `document.modelContext`. Seeing registration status does not prove that the host can call tools.

The current editor registers its real tools through the browser API required by the challenge. The implementation builds a typed catalogue and calls the following API for every tool:

```ts
document.modelContext.registerTool({
  ...tool,
  execute: async (input) => tool.execute(input),
});
```

See `src/editor-v2/webmcp/register-editor-tools.ts` and the related tool modules for the complete schemas, executors and safety flow.

For discoverability, the repository also preserves the illustrative snippet shown in the official challenge requirements. It documents the browser API shape; `search_products` is not a tool registered by this application:

```ts
document.modelContext.registerTool({
  name: "search_products",
  description: "Search the product catalog",
  inputSchema: { /* ... */ },
  execute: async (input) => { /* ... */ },
});
```

## Data and privacy

Projects autosave in IndexedDB and can be exported/imported as versioned JSON. They are not uploaded to Cloudflare or Varéra. Export a backup before clearing browser data or changing domains. Domains, ports and browser profiles have separate project libraries; moving from localhost or `pages.dev` to a custom domain does not move saved projects automatically.

All included fixtures are synthetic. Private projects, user exports, local recordings, credentials, builds and private development history are excluded.

## Structure

- `src/editor-v2`: editor, geometry, persistence, story/access model, routes, exports and WebMCP.
- `src/app`: thin Next.js entry routes for the current editor.
- `public/fonts/gelasio`: bundled fonts and their SIL Open Font License.
- `docs/deployment.md`: Cloudflare Pages setup, domains and production acceptance checks.
- `docs/hackathon-compliance.md`: required registration, evidence and release obligations.

## Licensing

Original project code is released under the MIT License; see `LICENSE`. Dependencies and fonts retain their own licenses: see `THIRD_PARTY_NOTICES.md` and `public/fonts/gelasio/OFL.txt`.
