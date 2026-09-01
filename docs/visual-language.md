# Visual language

## Direction

The first skin is an immersive historical cartographer's workshop, not a contemporary SaaS dashboard and not a modern vector editor with superficial sepia styling.

## Materials and atmosphere

- handmade warm paper with restrained fiber texture;
- graphite, ink, dark green cloth, aged wood, brass, and muted vermilion correction marks;
- warm evening light used at the edges and in depth cues, never across critical text;
- imperfect pencil and steel-nib rendering layered over exact geometry;
- atlas, folio, drawer, tab, tracing sheet, pin, and marginal-note metaphors;
- quiet motion resembling laying down paper, focusing a lens, or turning a translucent sheet.

Avoid neon AI gradients, glass cards, excessive pills, generic dashboard grids, floating sparkles, and decorative fake-historical controls that obscure meaning.

## Signature interactions

### Semantic lenses

Switch the presentation of one shared model among geometry, circulation, access, roles, constraints, narrative, light, and later scenario lenses. A lens changes emphasis, legend, overlays, and available actions without duplicating project state.

### Correction tracing

Agent proposals appear on a translucent correction sheet. Added, moved, removed, and affected elements remain visually distinguishable. The sheet contains consequences, resolved violations, new warnings, and controls to accept all, accept selected operations, revise, or reject.

### Visual explanations

Agent tools can navigate to the relevant scope and level, fit the view, highlight entities, draw routes, show reachable areas, mark blocked transitions, and display revision differences. Temporary explanation state is not saved as geometry unless the user pins it.

## Theme architecture

Keep separate tokens for:

1. application shell skin;
2. document/canvas rendering profile;
3. export style.

This allows later workshop skins and genre-specific document styles without replacing layout or domain logic.

## Internationalization and typography

- All interface and export strings come from message catalogs.
- English is the initial hackathon locale; Polish is structurally supported from the start.
- Fonts must cover Polish diacritics and remain legible at technical annotation sizes.
- Technical identifiers remain stable and language-neutral; labels and descriptions are localized.
- Texture, ornament, and handwriting effects must not turn text into images or reduce accessibility.
