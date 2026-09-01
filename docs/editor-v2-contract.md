# Editor v2 contract

This document is the behavioural boundary for the rebuilt editor. It is not a
list of visual preferences. Code that contradicts these rules is a defect even
when the resulting screen looks plausible.

## One project, one spatial hierarchy

- A project may contain independent roots as well as nested places.
- The standard path is world -> location -> object -> level -> room.
- No level is required merely to create a room, and no world is required to
  create a building.
- A building receives one level by default. Further levels are explicit peers
  in the hierarchy, not rectangles drawn inside the building.
- A child uses its containing geometry as context. Entering a place never
  creates a second copy of its boundary.
- Editing a child boundary updates the same canonical geometry visible in the
  containing view and is checked against siblings there.

## Work layers have behaviour

The seven work layers are always visible: Terrain, Boundaries, Buildings,
Construction, Doors and windows, Equipment, and Sketch. A layer determines:

- which subjects can be created;
- which instruments are offered;
- whether an open drawing is meaningful;
- how erasing behaves;
- which spatial constraints apply;
- what a completed gesture creates.

Changing a work layer does not silently discard an unfinished gesture. The
editor must offer to continue, preserve as sketch, or discard it.

### Terrain

Creates semantic terrain regions or paths. Terrain may overlap boundaries and
other terrain. Elevation is deliberately excluded until it has a dedicated
terrain model; it is never faked with an ordinary pencil stroke.

### Boundaries

Creates named places and zones. Boundaries may overlap and cross. They are not
room walls and do not partition all visible space.

### Buildings

Creates the exterior footprint of a building or other constructed object.
Buildings are navigable places and may receive a default level. A footprint is
not an interior room.

### Construction

Creates a wall network within the active level. Intersections become actual
junctions. Closed faces become rooms. Rooms never own an independent copy of
their geometry.

### Doors and windows

Creates openings anchored to walls and vertical transitions anchored to a
level. Generic pencil and shape instruments are unavailable here.

### Equipment

Creates ordinary semantic objects inside the active place. Equipment does not
partition rooms.

### Sketch

Creates an independently visible overlay. Sketch strokes and notes never alter
topology and can be hidden or faded as a group.

## Boundary editing is not a work layer

Drawing normally creates or edits contents of the open place. `Edit boundary`
is a separate action and names its target. When it is off, the active boundary
cannot be moved, reshaped, erased, or selected through an accidental gesture.

## Complete semantic operations

Undo and redo store complete operations. Moving a wall, rebuilding faces,
matching room metadata, and updating the hierarchy is one history entry.
Pending structural previews block navigation until accepted or cancelled.

## Clearing and deletion

`Clear current layer` names the layer, subtype, and open place before asking for
confirmation. It never deletes the hierarchy level itself. The operation is
one undoable history entry. `Delete selected` remains a separate command.

## Geometry kernel boundary

The application owns stable IDs, walls, openings, levels, metadata, and
history. JSTS supplies line noding, polygonization, overlays, and validation.
Flatten.js supplies analytic 2D geometry and hit testing. Neither library owns
the project hierarchy or user-facing semantics.
