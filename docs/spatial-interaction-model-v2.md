# Spatial interaction model v2

Status: accepted design baseline for the replacement editor. Visible integration still requires passing the interaction checkpoints below.

## Product premise

The application is a recursive spatial workshop. The same rules must support a world, a forest, a town, a building, a spacecraft, a deck, a room, or a furnished interior without forcing every project into one architectural vocabulary.

The project is a forest of independent spatial entities, not one mandatory tree. A useful complete hierarchy is:

```text
world
└── location (town, village, forest, district...)
    └── object (building, lake, cave, ship...)
        └── level (floor, deck, underground layer...)
            └── space (room, corridor, courtyard...)
                └── contents
```

The hierarchy may repeat, omit stages, or start anywhere. A cave need not have floors. A city may contain districts and nested locations. A spacecraft may contain decks and compartments. A project may also begin with one standalone room, floor, building, lake, or map that has no parent yet.

Each entity owns:

- one local boundary or spatial geometry;
- its name, optional description, semantic kind, tags, properties, and display rules;
- its own descendants, when any exist;
- an optional placement that maps it into a parent entity.

Containment is explicit and never inferred from visual overlap. A building belongs to a town because its placement says so, not merely because their polygons overlap. Moving the town therefore moves all of its placed descendants. A river owned directly by the world remains where it is even if it crosses the town's former position.

An unplaced entity remains fully editable. When the user navigates to a missing parent context, the application offers logical choices: place it in an existing parent, create the missing parent, wrap it in a simple parent such as a one-level building, or keep it standalone.

The normal way to create a spatial child is to draw it in the parent view, close or otherwise complete its geometry, and then name and classify it. A generic form must never invent a child outline or placement. Structural containers that may exist without a drawn boundary, such as a level, deck, or scene, use explicit context-specific commands.

**Create parent** is a first-class operation. It wraps the current standalone entity or subtree in a new parent without recreating its geometry. The current entity becomes a placed child of the new parent; the parent may begin as a boundary-less group and receive its own boundary through a deliberate drawing step. Reparenting to an existing entity remains a separate operation.

The optional description stores natural-language worldbuilding detail such as condition, appearance, history, or narrative meaning. Search covers names, descriptions, tags, semantic kinds, and owner-defined properties. WebMCP exposes the same corpus so an agent may match related meanings without requiring exact words; a vector index remains an optional later optimisation for very large projects.

## Project library

One local user may keep any number of independent projects without replacing or merging them. A project may represent one world, several related worlds, one standalone room study, or another collection chosen by its owner. Multiple project roots inside one project and multiple saved projects are separate concepts.

The local project library supports:

- create a blank project at any chosen starting scale;
- open and switch projects without losing autosaved work;
- duplicate a project under a fresh identifier;
- import a project as a new copy by default;
- explicitly replace an existing matching project only after confirmation;
- display name, last update time, root count, and a small preview when available.

Deletion is never implicit. Removing a project targets one exact identifier and its own checkpoints only, with a clear confirmation. No operation may clear the complete library as a side effect of starting or importing a project.

## One boundary, many editors

A spatial entity owns its boundary once in local coordinates. Its optional placement supplies the transform into its parent. Entering the child does not create another outline. It opens the same boundary at a more useful scale.

Examples:

- a town owns its own boundary and is placed on a world map;
- a building owns its footprint and is placed in a town;
- a level owns its boundary and is placed in a building;
- a level owns room boundaries derived from its walls;
- a room owns the placement of its furnishings.

Both parent and child views may edit the shared geometry:

- editing a building footprint from the town updates the building view;
- refining that footprint from inside the building updates the town immediately;
- moving a room wall from inside the room edits the same wall visible on the level;
- no copied outline may silently diverge from its source.

The parent remains the authority for available territory, sibling collisions, exclusions, and protected geometry. The child view is an alternative editor, not an independent world. Editing either representation updates the entity's single geometry and then revalidates its placement.

The parent's boundary is also the child's ordinary legal envelope, not a decorative reference. A child region, path, object, room, or furnishing may not be silently created, moved, or resized outside it. While the pointer is still moving, an invalid candidate remains a visibly marked draft; releasing it opens a plain-language conflict notice and does not persist the invalid geometry. Boundary-less structural groups are the deliberate exception and remain unconstrained until their own boundary is drawn.

Moving, placing, detaching, and deleting are distinct operations:

- **Move** changes an entity's placement and carries its entire descendant subtree.
- **Place in...** changes its parent while preserving its internal descendants.
- **Detach** removes the placement and makes the entity a standalone root without deleting it.
- **Delete** removes the chosen entity only after an explicit choice for descendants: delete them too, detach them, or move them to the former parent when that is geometrically valid.

## Editing across hierarchy boundaries

Every geometry change is evaluated in the nearest shared parent coordinate system. The validator transforms affected descendants and sibling occupancy into that system before accepting the edit.

### Safe

- refining a boundary inside unoccupied permitted territory;
- moving a wall without changing spaces, openings, routes, or occupied clearances;
- adding a balcony inside the object's permitted spatial claim.

### Consequential but confirmable

- expanding an object into empty parent territory;
- splitting, merging, resizing, or removing a space;
- changing the outline shown in the parent view;
- leaving some of the edited object's own contents outside its new boundary;
- changing a door's adjacent spaces or an existing route.

The confirmation describes the actual result in ordinary language and visually marks the affected area.

### Blocked conflict

- expanding into a sibling object's occupied area;
- moving a room wall through furniture belonging to another room;
- placing an opening away from a wall or over another opening;
- creating overlapping wall segments that cannot be normalized unambiguously;
- moving through locked or reserved clearance geometry.

The editor highlights the blocking object and offers navigation to it. It never reports only an internal term such as “junction”.

## Building levels and different outlines

A building has a spatial claim in its parent location. This is the area the building and its attached elements may occupy without colliding with neighbours. It is not required to be identical to every floor.

Each level has one shared boundary:

- the first level initially inherits the building footprint;
- a new level may inherit, copy, or start from another chosen level;
- every level may later be refined independently;
- an upper level may be smaller, stepped back, or contain voids;
- an overhang may extend beyond the level below while remaining inside the building's permitted claim.

Terraces, balconies, galleries, decks, roofs, and courtyards are explicit exterior or semi-exterior spaces attached to a level. They are not faked as ordinary indoor rooms.

The building's simplified parent-view shape is a projection with selectable modes:

- ground-level footprint;
- maximum envelope of all levels and attachments;
- roof outline;
- active level;
- owner-authored simplified symbol.

The default for a location overview is the maximum envelope, while a technical view may expose individual level outlines.

## Rooms and room-level editing

A closed wall face creates a persistent spatial record. Its semantic identity is stable even when the calculated polygon changes.

Entering a room:

- displays the same walls and boundary as the parent level;
- transforms them into a convenient local view;
- shows detailed furnishings and room-specific annotations;
- allows the same boundary walls to be edited;
- validates the edit against neighbouring spaces and their contents.

If a wall moves into empty neighbouring space, the editor reports the change of room areas and asks for confirmation when needed. If a wardrobe, stair landing, fixed installation, or locked clearance occupies the swept area, the operation is blocked and the obstacle is highlighted.

## Workspace and camera

The complete central editor panel is always the usable workspace, regardless of monitor size, zoom, rotation, or map coordinates.

- The canvas fills all available width and useful height.
- Camera pan, zoom, and rotation affect content only.
- Camera operations never change stored geometry.
- The canvas does not shrink to the current logical map bounds.
- Content is clipped at the editor boundary for the first stable implementation.
- A decorative translucent bleed may return later, but it must be independent from hit-testing, camera bounds, and usable workspace size.
- Menus and inspectors always remain above map rendering.

The beige folio is the complete map surface. Drawing controls live in a draggable instrument case above it and never reserve a strip of the map. The left and right books remain beside the folio by default and may be collapsed independently to give their width back to the map.

A small cartographic motto may remain fixed at the bottom edge of the folio. It belongs to the application skin, not map geometry, and therefore never pans, rotates, exports, or attaches to an object.

## Measurement and grid

Every editable spatial context has explicit local measurement settings rather than inferring units from its semantic kind.

- the internal geometry remains numerically stable when display units change;
- metric, imperial, and owner-defined story units may be selected where compatible;
- world and location views may use kilometres or miles while rooms use metres, centimetres, feet, or inches;
- the inspector displays the selected object's dimensions in the active display unit;
- an optional subtle coordinate-space grid has configurable spacing and stronger major lines;
- snapping to the grid is a separate option from showing it;
- the grid moves and rotates with map coordinates, while its controls remain fixed in the interface;
- changing units or grid visibility is presentational and never rescales an entity silently.

## Navigation

Navigation must be equally usable by mouse, touch, keyboard, and visible controls. The left book uses the project tree as its sole permanent navigation structure; it does not repeat the same path as breadcrumbs, visited-view history, and a separate back row.

Permanent or contextual controls:

- a collapsible project tree with the current entity clearly marked;
- a small, discreet “one level up” control on the map when a parent exists;
- a context mini-map later, if it materially improves orientation rather than duplicating the tree;
- a level/deck switcher only in the relevant object context;
- double-click or Enter to descend into an element;
- Escape as an optional shortcut for moving one level up when no edit is active.

The camera state may be remembered separately for every context, so returning to a town, level, or room restores the user's previous view.

## Context-sensitive drawing tools

The editor must not present the same generic shape palette at every scale. Shape creation and semantic classification are separate: the user may draw first and decide what the geometry means afterwards.

By default, drawing tools create and edit **children of the current entity**. On a level they therefore create rooms or structural children; inside a room they create furnishings, zones, or notes. The current entity's own boundary stays visible as the legal envelope but is not accidentally selectable or editable.

Editing that shared boundary requires a separate, explicitly named **Edit boundary** mode. Entering it changes the target of the same drawing and node tools from children to the current entity. The interface always displays the active target in words; leaving boundary mode returns to child editing. It must never be possible to mistake a boundary refinement for the creation of another child.

Creation has three independent choices:

1. **Target:** children of the current entity, or its own boundary through explicit **Edit boundary** mode.
2. **Meaning:** the active editing mode and semantic kind, for example `Terrain → Water`, `Interior structure → Partition wall`, or `Contents → Furniture`.
3. **Drawing method:** pencil, pen, polygon, rectangle, ellipse, connected wall run, or another compatible geometry tool.
4. **Appearance:** semantic style defaults plus the object's editable fill, opacity, pattern, and later optional style overrides.

Meaning never dictates shape. A lake may be a perfect square, an irregular pencil loop, or a precise Bézier compound path. A wall may be drawn freehand with the pencil, as a straight measured segment, or as a curved pen path. The chosen tool is converted into the canonical geometry required by its meaning: a pencil wall becomes an editable connected wall chain, not a decorative stroke.

When a semantic creation kind is already active, completing compatible geometry creates a named or nameable object of that kind immediately. For example, closing any shape while `Terrain → Water` is active creates a water object. The user may name it in the completion strip, leave it unnamed, or refine its type later.

Permanent geometry tools available where relevant:

- **Pen:** precise straight and curved segments with editable Bézier nodes and handles; closing the path creates a region.
- **Pencil:** natural freehand drawing with adjustable smoothing; the original trace remains editable and may be closed into a region.
- polygon, measured rectangle, circle, ellipse, arc, and compound shape;
- node editing, add/remove node, convert corner/smooth node, split path, join path, and close path.

The instrument case uses a coherent set of purpose-drawn SVG icons, not arbitrary typographic characters. Every icon has a Polish and English tooltip, an accessible name, and a visible textual readout of the currently active tool. Familiar conventions may be borrowed from established graphics software where they reduce guesswork, while the surrounding treatment remains part of the historical cartographer's-workshop skin.

Every closed region can be selected, named, and assigned a semantic kind appropriate to the context: location, terrain area, building, lake, room, courtyard, furnishing zone, narrative area, custom project kind, or another owner-defined type. Closing a path does not force a premature classification. It may remain an unnamed region until the user assigns meaning to it.

Open pen and pencil paths remain useful as roads, rivers, walls, borders, contour lines, routes, annotations, or decorative strokes. Their semantic kind determines validation and rendering; their drawing tool does not.

### Colour and style system

The initial visual rules combine semantic consistency with editable fills:

- line colour, weight, and dash pattern come from the semantic kind;
- closed regions expose an editable fill colour and opacity;
- a project palette provides historical defaults, recently used colours, and user-added swatches;
- an object may inherit its fill from its semantic kind or store an explicit override;
- a chosen fill may be applied only to the selection or saved as the project default for that semantic kind;
- changing the palette or visual skin never changes the object's semantic data.

Initial semantic line defaults may include:

- water: muted blue;
- forest and woodland: dark green;
- fields and cultivated land: brown or ochre;
- location boundaries: restrained grey dashed line;
- exterior structure: strong graphite line;
- interior partitions: lighter or narrower graphite line;
- openings and transitions: their own clearly distinguishable architectural marks.

The first release need not expose arbitrary line-colour editing. These defaults must nevertheless be defined as replaceable style tokens rather than scattered hard-coded colours, so a later project theme, blueprint mode, print mode, or visual skin can replace them coherently.

Colour is never the only carrier of meaning. Dash pattern, line weight, optional hatch/texture, labels, and the object catalogue preserve distinctions in monochrome exports and for users who do not distinguish every colour reliably.

### World and location

- region or location boundary;
- polygon, free curve, circle, ellipse, and measured rectangle;
- roads, rivers, paths, borders, and zones;
- place or object placement;
- label and annotation.

### Explicit editing modes

The user always knows which kind of geometry is being edited. Other modes remain visible as locked reference unless explicitly unlocked.

Initial modes:

1. **Terrain:** water, forest, meadow, field, greenery, and owner-defined surface regions.
2. **Elevation:** symbolic translucent elevation regions or contour paths with numeric height values.
3. **Location boundaries:** light dashed outlines defining named areas without implying ownership of everything inside them.
4. **Objects and exterior outlines:** buildings, lakes, caves, ships, and other placed spatial entities.
5. **Interior structure:** exterior walls, partitions, shafts, voids, and derived spaces.
6. **Openings and transitions:** doors, windows, gates, stairs, lifts, ramps, ladders, and portals.
7. **Contents and annotations:** furnishings, fixtures, narrative objects, labels, and measurements.
8. **Sketches and notes:** freehand concept strokes, handwritten notes, arrows, alternatives, and temporary construction marks that do not participate in topology or collisions.

A general selection mode may select any visible, unlocked object across modes. Switching editing mode never hides or duplicates the underlying geometry.

Sketch and note geometry uses a graphite-pencil style by default and may be hidden, locked, or excluded from clean exports independently. It remains saved with the project. Selected sketch strokes may later be promoted into a semantic kind such as wall, boundary, route, or terrain edge; promotion creates a reviewed geometry operation and runs the same validation as drawing the final object directly.

### Eraser tools

Erasing is an explicit tool family with three modes:

- **Object eraser:** removes a complete entity through the ordinary delete operation and reports dependent effects.
- **Segment eraser:** removes one wall edge or a bounded section of a vector path; closed regions may become open, split, or require a replacement boundary.
- **Free eraser:** a size-adjustable brush that cuts portions from pencil sketches and note strokes naturally.

These are presented as one compact split-button rather than three permanent toolbar entries or an extra form field. Clicking the main eraser icon immediately activates the last-used eraser. A marked corner opens a small palette containing the three variants, each with its own unmistakable icon and name. The chosen variant is remembered with local interface preferences, so the next click on the main icon behaves predictably.

The free eraser is immediate on sketch/notes geometry. On semantic geometry it creates a previewed vector subtraction or cut and reports whether it would create a hole, split an object, open a closed boundary, remove a room, detach an opening, or affect a route. It never silently rasterizes or damages structural geometry.

### Object and level

- exterior boundary and additions;
- connected wall chains;
- move wall, corner, or complete space;
- doors, gates, passages, windows, stairs, lifts, ramps, and ladders;
- terraces, balconies, voids, courtyards, shafts, and large fixed objects;
- optional grid, angle snapping, alignment guides, and live dimensions.

### Room and detailed space

- furnishings and fixtures;
- detailed zones and clearances;
- narrative objects and annotations;
- alignment, distribution, duplication, rotation, and mirroring.

The building interaction should borrow the clear mental model of life-simulation building tools:

- draw connected wall runs by clicking or dragging;
- automatically split walls at ordinary `T` and `X` intersections;
- fill newly closed spaces immediately;
- select a room by clicking its interior;
- drag a wall or corner directly;
- place and slide doors/windows along a wall;
- use a demolition tool for deliberate removal;
- show dimensions and consequences while the pointer is still moving.

This interaction model does not require orthogonal rooms. Angled walls, curves, compounds, holes, and irregular outlines remain supported.

## Selection, overlap, layers, and deletion

Shortcuts accelerate actions but are never the only route.

Visible interaction:

- selection tool and marquee mode;
- selection count and selected-item list;
- context menu with select, enter, duplicate, hide, lock, move order, and delete;
- “choose from this point” popover when objects overlap;
- layers panel with visibility, lock state, and ordering;
- trash/demolition button appropriate to the selected kind;
- confirmation only when deletion has meaningful dependent effects.

Optional shortcuts:

- Shift/Ctrl/Command toggles selection;
- Alt/Option-click cycles through the stack under the pointer;
- Delete/Backspace invokes the same deletion command as the visible button;
- Escape cancels the current drawing or moves up when no operation is active.

Walls receive a wider invisible hit area than their visible stroke. Locked elements remain visible but cannot be moved accidentally. Hidden elements do not participate in hit-testing.

## Current-view object catalogue

The right side of the workspace contains a complete, searchable catalogue of objects visible or belonging to the selected view. It complements the project navigation tree; it does not replace it.

The catalogue:

- groups objects into collapsible editing modes/layers;
- shows nested placed descendants as collapsible sublevels;
- distinguishes direct children, inherited reference geometry, and deeper preview-only descendants;
- allows selection by clicking a row and multi-selection through visible controls as well as optional modifier keys;
- keeps canvas and list selection synchronized in both directions;
- exposes visibility, lock state, semantic kind, and warnings without requiring a context menu;
- provides search and filters by name, kind, layer, visibility, and warning state;
- makes covered or very small objects selectable even when they are difficult to hit on the canvas.

Selecting a catalogue row reveals the same inspector and actions as selecting the object on the map. Expanding a row reveals its child entities, but does not automatically descend into their editing context. A separate visible **Enter** action performs navigation.

## Openings and routes

A door is an opening anchored to one wall by position and width. It is never drawn at the midpoint between two arbitrary places.

- Internal doors derive the spaces on their two sides from current wall geometry.
- External doors connect a space to the explicit outside of its level or object.
- Windows do not create walking connections.
- Stairs, lifts, ramps, ladders, and portals are explicit transitions with landings at both ends.
- The route graph is derived from these physical transitions and never from polygon adjacency alone.

## Adjustable level of detail

Detail controls affect presentation only; they do not create separate geometry.

Initial presets:

- **Overview:** direct child locations/objects, major routes, labels, simplified outlines.
- **Structure:** boundaries, levels, spaces, openings, major fixed objects, access overlays.
- **Detail:** furnishings, fixtures, annotations, clearances, fine paths, and narrative objects.

Each context type has a sensible default:

- world: locations and selected landmarks;
- location: objects and optional simplified interior hints;
- object: level envelopes and major spaces;
- level: rooms, openings, circulation, and optionally large furniture;
- room: detailed furnishings and annotations.

The owner may override these defaults per project and toggle individual layers. A detail slider changes the preset; the layer panel provides precise control.

## Core interaction flows

### Standalone entity first

1. Start a new project at any useful scale, such as a room, building, terrain map, or town.
2. Draw with the pen, pencil, or measured shape tools and classify closed regions when useful.
3. Keep the entity as a standalone project root for as long as needed.
4. Use **Create parent** to wrap it in a suitable new parent, place it in an existing parent, or keep it standalone.
5. Placement never recreates or replaces the entity's geometry.

### World to location

1. Draw or select a location boundary on the world map.
2. Enter it through double-click, Enter, or a visible action.
3. The same boundary becomes the full local context boundary.
4. Refine it if needed; parent collisions remain enforced.

### Location to object

1. Draw an object footprint in the location.
2. Name and classify it without leaving the canvas.
3. Enter it; the same footprint becomes its inherited boundary.
4. Refinement updates the location view immediately.

### Object to level

1. Create the first level from the object footprint.
2. Add further levels by inherit, copy, or blank-within-claim.
3. Choose which projection the parent location displays.
4. Switch levels without leaving the object context.

### Level to room

1. Draw connected exterior and partition walls.
2. Closed spaces become selectable records immediately.
3. Name/classify a space from the canvas or current-view catalogue and place openings on its walls.
4. Enter it without creating a second outline.

### Room to contents

1. Show the inherited room boundary and neighbouring constraints.
2. Place furnishings and fixtures in room-local coordinates.
3. Edit a shared wall if required.
4. Block collisions with neighbouring occupied geometry and explain the obstruction.

## Implementation boundary

Parts likely reusable from the prototype:

- project history, undo/redo, checkpoints, and the multi-project repository abstraction;
- internationalization structure;
- visual skin and document styling;
- import/export packaging;
- WebMCP registration pattern;
- camera mathematics after the canvas boundary bug is removed.

Parts to replace or substantially redesign:

- spatial schema and context geometry ownership;
- plan resolver and renderer;
- selection and hit-testing;
- drawing tools and wall normalization;
- openings, transitions, and route derivation;
- structural consequence facts and user-facing explanations.

The current prototype remains a reference until the replacement passes the agreed interaction flows and migration tests.
