# Cloudflare Pages deployment

## Deployment shape

The app stores data and performs computation in the browser. Next.js static export produces `out/`, including the current editor routes, worker code and fonts. Cloudflare Pages serves these files without an application server, database, secret or persistent disk. Adding server actions, API handlers or server-side authentication later requires a separate backend decision; the static frontend can remain on Pages.

Use the Git integration with this clean public repository as the build root. The required Pages settings are:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js (Static HTML Export) |
| Production branch | `main` |
| Build command | `npm exec --yes --package=pnpm@11.7.0 -- pnpm install --frozen-lockfile && npm exec --yes --package=pnpm@11.7.0 -- pnpm build` |
| Build output directory | `out` |
| Environment variable | `NEXT_TELEMETRY_DISABLED=1` |

`.node-version` pins Node and `package.json` pins pnpm. Serve only `out/`; do not publish development folders or the repository directory as site assets. `public/_headers` is copied into the export and supplies the production security headers.

Before connecting the repository, review the approved license, exact public commit, Cloudflare account, project name and production branch. Automatic Git deployments should remain disabled or the repository must remain frozen whenever the competition rules require the submitted version not to change.

## Address and domain

The initial deployment receives an HTTPS `pages.dev` address. Use one canonical public address consistently in the README, video and submission. The intended custom address is `cabinet.varera.studio`; registration and DNS remain separate from hosting.

IndexedDB belongs to the browser origin. Export/import JSON to move projects between localhost, `pages.dev` and custom-domain addresses. Neither Cloudflare nor the application can migrate private browser storage to another origin automatically.

## Acceptance checks on the actual public URL

A local build does not replace these checks after deployment:

1. Open `/` in a fresh browser profile without an account or pre-existing project. Select English and confirm usability. Confirm `/editor-v2/` opens the same current editor.
2. Refresh that nested URL. Verify chunks, styles, icon and all four fonts load without errors.
3. Confirm the response includes `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy` from `_headers`.
4. Create synthetic data; edit, undo/redo, reload, export JSON and import a copy. Verify persistence.
5. Calculate a route through the worker; compare its result with the local build.
6. Export SVG, PNG and PDF, including accented text. Inspect the files.
7. In a compatible WebMCP browser AND agent host, discover tools, read context, prepare/inspect a change, and apply/undo it according to the existing contract. A registration badge alone is insufficient evidence.
8. Measure the tool-description budget using the final public origin. Longer domains affect this budget; localhost results are not production results.
9. Record the commit, canonical URL and results. Preserve the required competition freeze.

## Official references

- [Static Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
