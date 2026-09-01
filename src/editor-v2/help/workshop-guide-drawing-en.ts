import { styled, type WorkshopGuideTopic } from "./workshop-guide-model";

const en: WorkshopGuideTopic = {
  id: "drawing",
  title: "Drawing the map",
  summary: "How the Tool case works, how layers, objects and instruments differ, and how to draw and refine a map.",
  sections: [
    {
      heading: "From a blank sheet to the first line",
      paragraphs: [
        styled("In ", { text: "Drawing", emphasis: "strong" }, ", you build the physical side of the world: terrain, roads, buildings, walls, doors, stairs, furnishings and everything else that has a place on the map."),
        styled("The main tools are in the ", { text: "Tool case above the sheet", emphasis: "strong" }, ". This is where you choose:"),
      ],
      bullets: [
        styled("the ", { text: "layer", emphasis: "strong" }, " — what kind of map content you are working with and which rules it follows,"),
        styled("the ", { text: "object kind", emphasis: "strong" }, " — ", { text: "what", emphasis: "em" }, " you are drawing,"),
        styled("the ", { text: "instrument", emphasis: "strong" }, " — ", { text: "how", emphasis: "em" }, " you want to give it shape."),
      ],
      subsections: [
        { heading: "A layer is not an Atlas level", paragraphs: [styled("A layer does not say ", { text: "where an object sits in the Atlas", emphasis: "strong" }, ". Water may appear on a world map as a lake, on an estate map as a pond, or on a floor as a fountain. You still use the same layer; only the map you are working on changes."), "It sounds more technical than it is in practice.", styled("To draw a forest, choose ", { text: "Terrain", emphasis: "strong" }, ", then ", { text: "Forest", emphasis: "strong" }, ", then a way to draw it, such as Pencil or Polygon."), styled("For a rectangular table, choose ", { text: "Objects → Furniture → Rectangle", emphasis: "strong" }, "."), styled("For a door, choose ", { text: "Construction → Door → Place", emphasis: "strong" }, "."), styled({ text: "What is it? → How do I want to draw it?", emphasis: "strong" })] },
      ],
    },
    {
      heading: "Layers — keeping order on the cartographer's desk",
      paragraphs: [styled("A layer tells the Cabinet ", { text: "what kind of map content you are working with", emphasis: "strong" }, ". This lets the application apply the right behaviour."), "A road has a route and width. A forest covers an area. A door must sit in a wall. Furniture can move freely around a room. They share one map, but the Cabinet treats each according to different rules.", "The Tool case contains several main layers."],
      subsections: [
        { heading: "Terrain", paragraphs: [styled("This is where the landscape takes shape: ", { text: "water, rivers, streams, meadows, fields, forests, rocks", emphasis: "strong" }, " and other surfaces."), "Use Terrain to say: ‘this part of the map is forest’, ‘a river flows here’, or ‘the lake begins here’." ] },
        { heading: "Roads", paragraphs: [styled("This layer holds routes: ", { text: "paved and dirt roads, paths, alleys and pavements", emphasis: "strong" }, "."), styled("A road is more than a line. It has a route and a width, and you can later ", { text: "widen or narrow it locally", emphasis: "strong" }, " — perhaps widening a drive by the gate or narrowing a path between buildings."), styled("As you draw, the Cabinet tries to route a road naturally and ", { text: "avoid buildings", emphasis: "strong" }, " in its way. Roads can still cross different terrain, including meadows, forests and fields."), "Their course and width can later be used when finding routes."] },
        { heading: "Boundaries", paragraphs: [styled("Boundaries mark ", { text: "conceptual divisions of space", emphasis: "strong" }, ": the edge of a settlement, plot, district or another defined area."), styled("Use them to show ", { text: "where something begins or ends", emphasis: "strong" }, ", regardless of what physically lies on either side. A boundary may cross forest, fields, buildings or several surfaces."), styled("One option in this layer is an ", { text: "Area boundary", emphasis: "strong" }, ". It is a visible mark on the map. It is different from a Zone in Story, which groups objects and may give them shared traits.")] },
        { heading: "Buildings", paragraphs: [styled("This is where you place ", { text: "buildings, towers, ruins, bridges that are structures", emphasis: "strong" }, " and other architecture seen from outside."), "A building can later gain its own interior and floors in the Atlas."] },
        { heading: "Construction", paragraphs: ["This is the workshop for building interiors.", styled("Here you raise ", { text: "structural and partition walls", emphasis: "strong" }, ", add ", { text: "doors, windows, gates and passages", emphasis: "strong" }, ", create ", { text: "stairs and lifts", emphasis: "strong" }, ", and add surfaces such as ", { text: "terraces, balconies, platforms, mezzanines and stages", emphasis: "strong" }, "."), "If you are planning a house, palace or dungeon, you will probably spend quite some time here."] },
        { heading: "Objects", paragraphs: [styled("This layer holds furnishings and smaller site features: ", { text: "furniture, objects, plants, monuments, small architecture and markers", emphasis: "strong" }, "."), "A dining-room table, a garden statue or one particular tree belongs here, rather than in a whole area of forest."] },
        { heading: "Sketch", paragraphs: ["Sketch is your rough-work layer.", "Add guide lines and notes before deciding what truly belongs on the map. You can hide the Sketch later or show it at lower opacity."] },
      ],
    },
    {
      heading: "Object kind and instrument are different things",
      paragraphs: ["This distinction is worth learning from the start.", styled({ text: "The object kind answers ‘what am I making?’", emphasis: "strong" }), styled({ text: "The instrument answers ‘how do I give it shape?’", emphasis: "strong" }), "A Rectangle is therefore not a kind of building. It is one way to draw a building.", "The same Rectangle can draw a building, a piece of furniture or an area of terrain, provided that object kind supports it.", styled("Not every instrument suits everything. A door does not need a Pencil because you ", { text: "place it in an existing wall", emphasis: "strong" }, ". A point marker only needs one click."), "The Tool case shows only sensible choices for what you are currently making."],
    },
    {
      heading: "Instruments — what is the difference between Pencil and Pen?",
      paragraphs: [],
      subsections: [
        { heading: "Select & edit", paragraphs: ["The main instrument for working with things that already exist.", "Select an object, then move, resize or reshape it as its kind allows."] },
        { heading: "Select an area", paragraphs: ["Selects several objects at once.", "Drag a rectangle around part of the map. This is useful for moving all the furniture in a room or aligning several items together."] },
        { heading: "Pencil", paragraphs: [styled({ text: "Pencil is for freehand drawing.", emphasis: "strong" }), "Move the pointer as you would move a pencil over paper, and the Cabinet records your stroke.", "It is particularly good for organic forms: an irregular shoreline, a forest sketch, a winding path or a rough outline.", styled("Increase ", { text: "Pencil smoothing", emphasis: "strong" }, " when you want the application to remove more of the small tremors in your hand.")] },
        { heading: "Bézier pen", paragraphs: [styled("The Pen creates ", { text: "precise, smooth curves", emphasis: "strong" }, "."), "Instead of tracing the whole line by hand, place successive points. Each can have handles that control the curve's direction and bend.", styled("Use Pencil when you simply want to ", { text: "draw a line", emphasis: "em" }, "; use Bézier pen when you want to ", { text: "design it", emphasis: "em" }, "."), "Afterwards, you can move its points and handles and change nodes between sharp and smooth."] },
        { heading: "Straight line", paragraphs: ["Creates one straight segment between two chosen points."] },
        { heading: "Wall run", paragraphs: ["Creates a succession of connected wall segments without starting each one separately.", styled("Choose the first point, then the next and the next, as though tracing walls around rooms. Press ", { text: "Enter", emphasis: "strong" }, " when the complete wall run is ready.")] },
        { heading: "Rectangle", paragraphs: ["Choose two opposite corners and the Cabinet builds a rectangle between them.", "This is a quick way to make regular rooms, buildings, furniture and many other objects."] },
        { heading: "Circle", paragraphs: ["Choose the centre first, then a point on the circumference."] },
        { heading: "Ellipse", paragraphs: ["Choose two opposite corners of the rectangle that should contain the ellipse."] },
        { heading: "Three-point arc", paragraphs: ["Choose three points and the Cabinet draws an arc through them.", "Use it for a controlled bend without constructing a complete Bézier curve."] },
        { heading: "Polygon", paragraphs: ["Place successive vertices around an area.", "This is one of the main instruments for irregular plots, gardens, forests, courtyards and buildings that refuse to behave like proper rectangles."] },
        { heading: "Point", paragraphs: ["Places an object at one chosen location.", "It is mainly used for markers and other small point objects."] },
        { heading: "Place", paragraphs: [styled("Used for things that must be ", { text: "set into something that already exists", emphasis: "strong" }, "."), "Doors and windows are the main examples: first create a wall, then choose where its opening belongs."] },
        { heading: "Write note", paragraphs: ["Mark an area on the sheet and enter supporting text.", "A note belongs to Sketch, so it can be hidden with the other supporting marks."] },
        { heading: "Eraser", paragraphs: ["The Eraser behaves differently according to what it touches.", "It may cut part of a surface, split a wall, rub out part of a sketch or remove an entire object. Set its width in the Tool case."] },
      ],
    },
    {
      heading: "Drawing your first object",
      paragraphs: ["Suppose you want to draw a rectangular building."],
      steps: [styled("Switch to ", { text: "Drawing", emphasis: "strong" }, "."), styled("In the Tool case, choose ", { text: "Buildings", emphasis: "strong" }, "."), styled("Choose ", { text: "Building", emphasis: "strong" }, "."), styled("Choose ", { text: "Rectangle", emphasis: "strong" }, " as the instrument."), "Choose the first corner on the sheet.", "Choose the opposite corner."],
      subsections: [{ heading: "After drawing", paragraphs: [styled("You see a ", { text: "shape preview", emphasis: "strong" }, " before it is saved."), styled("When it is complete, switch to ", { text: "Select & edit", emphasis: "strong" }, ", select the building and refine it without starting again."), "Most work in the Cabinet follows this pattern: choose what to make and how to make it, then refine it freely."] }],
    },
    {
      heading: "Not every line must be perfect at once",
      paragraphs: ["A freehand or multi-point shape may fail to close correctly, or it may extend beyond the area where it is allowed to exist.", "The Cabinet does not have to discard your work immediately.", "If part of the drawing extends beyond the allowed outline, the Cabinet clips it to that outline automatically. If the entire drawing lies outside it, the object is not created.", "In other situations, depending on the object kind and the state of the drawing, it may offer to:"],
      bullets: ["continue drawing,", "close it automatically,", "preview the automatic closure,", "keep it as an open path,", "move it to Sketch,", "or discard it."],
      subsections: [{ heading: "Closing gaps", paragraphs: [styled("Not every choice is available for every kind of object. The Tool case also has ", { text: "Close gaps", emphasis: "strong" }, " and a tolerance setting. These join line ends that only miss each other by a small amount."), "On building plans, this can save a surprising amount of hunting for microscopic gaps between walls."] }],
    },
    {
      heading: "Selecting and refining existing work",
      paragraphs: ["Drawing an object is not the end of the work.", styled("Choose ", { text: "Select & edit", emphasis: "strong" }, " and select an object on the sheet. Handles appropriate to its kind will appear."), "Depending on the object, you can:"],
      bullets: ["move it,", "rotate it,", "resize it,", "move vertices,", "adjust wall ends,", "edit the route and local width of roads and rivers,", "edit curves,", "add and remove nodes,", "split open paths,", "lock or hide it,", "duplicate or delete it."],
      subsections: [{ heading: "Actions follow the object", paragraphs: ["Not every action appears for every object. A table does not need road nodes, and a door has no forest outline. The Inspector and handles show actions that suit the selected thing."] }],
    },
    {
      heading: "Inspector — details of the selected object",
      paragraphs: [styled("After selecting an object, look in the ", { text: "book on the right", emphasis: "strong" }, "."), "The Inspector shows information that cannot be adjusted by dragging handles and provides the properties that can be edited for that kind of object.", "For most objects, it includes a name, description, tags, colour, opacity and other properties appropriate to the selected thing.", "For a road, you can change its overall width; use map handles for local width. For a wall, the Inspector shows its kind and thickness. For a door, it shows the opening kind and lets you change its width. For stairs, you can change their shape, direction and connected floors; for a note, its text and type size.", styled("At the end of the same book is the ", { text: "list of objects on the open sheet", emphasis: "strong" }, ". Use it to select and search by name or description, and to hide, lock or delete objects."), "The list is especially useful once the map is so dense that trying to select the one correct side table begins to resemble surgery."],
    },
    {
      heading: "Several objects at once",
      paragraphs: ["You do not need to adjust everything individually.", "With several objects selected, you can duplicate, rotate or mirror the whole selection, align objects, and distribute them at equal intervals.", styled("Suppose six chairs stand along a ballroom wall. Instead of positioning each by eye, select all six and choose ", { text: "distribute horizontally", emphasis: "strong" }, "."), "The Cabinet handles the part where a real cartographer would already be quietly cursing the ruler."],
    },
    {
      heading: "Joining shapes",
      paragraphs: ["Some objects can also be joined."],
      bullets: [styled({ text: "Roads", emphasis: "strong" }, " can join at their ends or form a junction."), styled({ text: "Rivers and streams", emphasis: "strong" }, " can join without losing their widths."), styled({ text: "Buildings", emphasis: "strong" }, " can merge into one mass. Choose whether former joins disappear or remain as internal walls."), styled({ text: "Rooms", emphasis: "strong" }, " can also merge when they should no longer be separate spaces.")],
    },
    {
      heading: "Adding to and cutting from an outline",
      paragraphs: ["You do not always need to rebuild the entire shape.", styled({ text: "Add to outline", emphasis: "strong" }, " joins a new part to an existing area. Use it to add a building wing, widen a terrace or enlarge an area of terrain."), styled({ text: "Cut a void", emphasis: "strong" }, " does the reverse and subtracts part of an area. It can make:")],
      bullets: ["an inner courtyard,", "a hole in the middle of a surface,", "an empty space surrounded by a building."],
    },
    {
      heading: "The current map outline",
      paragraphs: [styled("Every map can have an ", { text: "outer boundary", emphasis: "strong" }, " that says which area actually belongs to it."), styled("For a building, this may be the ", { text: "outer outline of its mass", emphasis: "strong" }, ". A U-shaped palace map can follow that shape instead of occupying the whole rectangular sheet."), styled({ text: "Edit boundary", emphasis: "strong" }, " lets you refine it. When finished, close boundary editing again to prevent accidental changes."), styled({ text: "Floors inherit the building outline by default", emphasis: "strong" }, ", so you need not redraw the same mass on every floor."), "You may still change one floor's outline when the building differs there — perhaps the ground floor fills the whole palace, while an upper floor is smaller or has an extra terrace.", "There is no need to tear apart the whole building structure because one floor has decided to step out of line architecturally."],
    },
    {
      heading: "Grid, snapping and measurements",
      paragraphs: [styled("If you dislike the architectural style known as ‘the wall was probably straight until the cartographer sneezed’, switch on the ", { text: "grid", emphasis: "strong" }, "."), styled("View settings let you show the grid and axes, change grid opacity and spacing, and enable ", { text: "snap to grid", emphasis: "strong" }, "."), "Snapping places new and moved points on grid lines or intersections. It is particularly useful for regular building plans.", styled("You can also choose ", { text: "metres or feet", emphasis: "strong" }, " and display calculated object areas.")],
    },
    {
      heading: "Moving around the sheet",
      paragraphs: ["Do not confuse moving the view with moving an object.", styled("When you move the ", { text: "view", emphasis: "strong" }, ", it is as though you were sliding the sheet beneath glass. Everything drawn on it stays exactly where it was."), "You can:"],
      bullets: ["pan across the sheet,", styled({ text: "zoom with the mouse wheel", emphasis: "strong" }, " or the ", { text: "+ / −", emphasis: "strong" }, " buttons in the workspace,"), styled({ text: "rotate the view with the compass rose", emphasis: "strong" }, " in the corner of the sheet,"), styled("select the ", { text: "home symbol beside + / −", emphasis: "strong" }, " to restore the initial view.")],
      subsections: [{ heading: "The view does not change the project", paragraphs: ["Rotating the view does not rotate the project. Turn the map sideways and the world's north will not suffer an existential crisis."] }],
    },
    {
      heading: "When something goes wrong",
      paragraphs: [styled({ text: "Undo", emphasis: "strong" }, " and ", { text: "Redo", emphasis: "strong" }, " sit at the top of the Tool case."), "Undo removes the latest change. Redo restores the change you have just undone.", "There is no need to fear every handle you drag.", "For larger experiments, such as rebuilding an entire floor, you can also save a separate project version. Versions and tracings have their own chapter later."],
    },
    {
      heading: "The simplest working recipe",
      paragraphs: ["If the Tool case looks slightly alarming at first, remember one pattern:"],
      steps: [styled({ text: "Choose a layer.", emphasis: "strong" }, " What kind of map content are you working with?"), styled({ text: "Choose an object kind.", emphasis: "strong" }, " What are you making?"), styled({ text: "Choose an instrument.", emphasis: "strong" }, " How do you want to give it shape?"), styled({ text: "Draw on the sheet.", emphasis: "strong" }), styled({ text: "Switch to Select & edit.", emphasis: "strong" }), styled({ text: "Refine the shape on the map and its details in the Inspector.", emphasis: "strong" })],
      subsections: [{ heading: "That is enough to begin", paragraphs: ["The rest of the Tool case can wait in its compartments until you actually need it."] }],
    },
  ],
};


export const drawingGuideTopicEn = en;
