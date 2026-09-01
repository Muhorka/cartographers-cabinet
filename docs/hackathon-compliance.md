# WebMCP submission evidence

Mapping to the official [rules](https://webmcp.devpost.com/rules) and [resources](https://webmcp.devpost.com/resources), checked on 2026-08-31. This is not proof of an accepted submission.

## Required registration example

The organizer illustrates `document.modelContext.registerTool({ name, description, inputSchema, execute })`. The sample `search_products` demonstrates the API shape; this app registers real spatial tools rather than a fictional shop tool.

The implementation is [register-editor-tools.ts](../src/editor-v2/webmcp/register-editor-tools.ts), which calls `document.modelContext!.registerTool({ ...tool, execute }, { signal })`. The TypeScript non-null assertion disappears in the browser build. Tool definitions provide names, descriptions, schemas and executors; the wrapper records calls and returns their results.

The browser API must be present AND the agent host must expose it. Unit tests and registration status do not replace a successful live workflow on the public URL. Do not add a dummy registration just to reproduce the example text.

No separate mandatory sponsor copyright header was identified in the official requirements reviewed. Third-party license and attribution obligations still apply.

## Final submission obligations

- Public, working current-editor URL accessible in the required WebMCP environment, not localhost or an account-only preview.
- Public complete source repository with assets, run instructions and a recognized open-source root license.
- Public YouTube demo shorter than three minutes, with audio and English narration or translation. Show the actual app and an agent workflow.
- English explanation of users, WebMCP fit, benefits for humans and agents, implementation and new capabilities.
- Accurate distinction between pre-existing and event-period work. A clean public Git snapshot protects privacy; its commit date does not prove all code was written then.
- Final Devpost draft verification and explicit submission. A GitHub push does not submit an entry.

Reviewed deadline: **2026-09-03 20:00 UTC**. Recheck the official page before submitting. Preserve free access and obey the official freeze on the submitted repository, app and video through the required judging/announcement period.

## Limits of the evidence

Only the current editor is included. Use the canonical root URL consistently in the submission and video; `/editor-v2/` is an equivalent compatibility route. Choose English for demonstrations.

A successful deployment does not certify every geometry, route or access-rule result. A local suite does not prove native WebMCP host connectivity. Record these outcomes separately instead of treating a green build as a complete competition audit.
