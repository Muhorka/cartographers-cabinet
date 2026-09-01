import type { WorkshopGuideTopic } from "./workshop-guide-model";
import { styled } from "./workshop-guide-model";

const quote = (text: string) => styled({ text: `“${text}”`, emphasis: "em" });

export const agentGuideTopicEn: WorkshopGuideTopic = {
  id: "agent",
  title: "Working with your own agent",
  summary: "How an agent helps you build an editable world, develop stories and work safely with real project data.",
  sections: [
    { heading: "A second cartographer at the table", paragraphs: [
      styled("You can use the Cartographer’s Cabinet on your own. You can also invite an ", { text: "AI agent", emphasis: "strong" }, " into the open project and build the world together."),
      "The agent’s role is not limited to pressing buttons for you.",
      styled("Through WebMCP, it can ", { text: "read the project’s structured data", emphasis: "strong" }, ", understand its structure and use its own reasoning to plan, analyse and develop the world."),
      "You can therefore begin with an ordinary description instead of placing every object by hand:",
      quote("I want a small coastal town with a harbour, an old centre on a hill and a newer industrial district beside the railway."),
      "The agent can turn that idea into a real Cabinet project: create a suitable Atlas structure, arrange places, add roads, buildings and other elements, then return to the project with you later.",
      "The result is not an image generated once and left unchanged.",
      styled("It remains an ", { text: "editable project", emphasis: "strong" }, " in which you can move buildings, rebuild districts, add floors, change access rules or ask the agent for another version."),
    ] },
    { heading: "From an idea to an editable world", paragraphs: [
      "A single request can involve many operations inside the Cabinet.",
      "If you say:",
      quote("Design a large residence with formal rooms at the front, private rooms facing the garden and a separate service wing."),
      "the agent can break that goal into smaller decisions by itself.",
      "It can create the building and its floors, divide the interior, plan circulation, add doors and stairs, lay out the surroundings and later enrich the project with Story data.",
      "The Cabinet gives the agent tools for reading the project, creating and modifying objects, rebuilding the hierarchy, and working with construction, Story, routes, versions and the Project Library. The agent can also combine a series of prepared changes into one operation.",
      "The strength of this collaboration is not that the agent can draw a rectangle.",
      styled("It is that the agent can ", { text: "compose many small operations into one larger design", emphasis: "strong" }, "."),
    ] },
    { heading: "Refining together instead of generating once", paragraphs: [
      "The first version does not have to be final. You can inspect the result and say:",
    ], bullets: [
      quote("The centre works well, but the harbour takes up too much space."),
      quote("Keep the residential part as it is, but rebuild the service area."),
      quote("I need another entrance for the staff. Find a sensible place for it."),
    ], subsections: [
      { heading: "The world stays on the table", paragraphs: [
        "The agent can read the existing project again, preserve the accepted parts and work on the stated problem. The more clearly you say what must remain unchanged, the easier it is to preserve the chosen direction.",
        "This is what distinguishes collaborative design in the Cabinet from generating a map once. You do not have to return to a blank sheet every time.",
        styled({ text: "The world stays on the table. You can return to it, revise it and develop it together.", emphasis: "strong" }),
      ] },
    ] },
    { heading: "The agent can think on several levels at once", paragraphs: [
      "The Cabinet stores more than geometry.",
      "The agent can read the Atlas structure, map objects and construction, as well as characters, groups, owners, traits, zones, access rules, keys, scenarios, intentions and saved routes.",
      "This lets it consider different questions together while designing:",
    ], bullets: [
      quote("Where will a second staircase fit?"),
      quote("Who will use it?"),
      quote("Does it lead to places this group may enter?"),
      quote("If the main passage closes, is another sensible route still available?"),
      quote("Does this layout really separate public space from private space?"),
    ], subsections: [
      { heading: "Calculation and interpretation", paragraphs: ["The Cabinet can formally check some of these answers — for example, by calculating a route or applying saved access rules. Others require the agent’s interpretation. Combining the two is precisely what makes this useful."] },
    ] },
    { heading: "From building a world to telling stories in it", paragraphs: [
      "Collaboration with an agent does not end when the map is ready.",
      styled("The Cabinet can become the ", { text: "shared spatial memory of author and agent", emphasis: "strong" }, "."),
      "It stores the layout of the world and the meanings recorded within it: inhabitants, ownership, groups, traits, relationships, access, keys, zones, scenarios and the author’s intentions.",
      "The agent can read that knowledge later and use it in an ordinary conversation. You do not need to explain again where the study lies, where the corridor leads, which doors are locked and who holds the key.",
      "Together, you can then consider:",
    ], bullets: [
      "how a character might reach a difficult place",
      "where a particular scene would work best",
      "which obstacles follow from the actual layout of the building or town",
      "what changes when part of the map is closed",
      "which characters have a reason or opportunity to meet in a particular place",
      "which conflicts may arise from ownership or access",
      "what is missing from the designed world",
      "how to describe a journey in accordance with the actual route",
      "whether a new event contradicts earlier assumptions",
    ], subsections: [
      { heading: "Example: the way to the archive", paragraphs: [
        "Suppose a character must get from the garden to the archive without being noticed. The Cabinet can give the agent real information: where the passages lead, which doors are locked, whether a secret passage exists, who knows about it, which zones lie along the way and where a guard has been recorded.",
        quote("The most plausible route seems to go across the terrace and through the staff corridor. It is longer, but avoids the main entrance. The guard by the stairs remains a problem — the scene may require a distraction."),
        "The Cabinet has not proved that the character will remain unnoticed. It supplied facts and spatial constraints. The agent interpreted them. The author decides what actually happens in the story.",
      ] },
    ] },
    { heading: "Facts, calculations and creative suggestions", paragraphs: [
      "When working with an agent, it helps to distinguish three things.",
      styled({ text: "Project facts", emphasis: "strong" }, " are pieces of information actually recorded in the Cabinet: the location of a room, its owner, the width of a road, who holds a key or which zone an object belongs to."),
      styled({ text: "Results from the Cabinet", emphasis: "strong" }, " are produced when the application calculates or checks something — for example, when it plans a route or checks an author intention."),
      styled({ text: "Creative suggestions from the agent", emphasis: "strong" }, " are the agent’s interpretation of those data."),
      "If the agent says that the store-room door is locked and Anna does not have the right key, that may follow directly from project data. If it adds that this would be a good place for a confrontation because there is only one convenient entrance, the second statement is its judgement.",
      "That does not make it less useful. It is simply helpful to know what the Cabinet knows, what it can calculate and what the agent is suggesting on its own.",
    ] },
    { heading: "The agent can inspect and repair the project too", paragraphs: [
      "After building a map, the agent can return to it as an inspector. The Cabinet lets it inspect the project structure, examine construction, search for objects and diagnose some problems involving data, geometry and connections.",
      "You can ask:",
    ], bullets: [
      quote("Review this floor and look for problems."),
      quote("Check whether the rooms have sensible ways in."),
      quote("Do you see anything suspicious after my latest rebuild?"),
      quote("Check the project’s saved assumptions."),
    ], subsections: [
      { heading: "Building, inspecting and repairing", paragraphs: ["If the agent finds a problem, it can describe it, prepare a proposed correction or — if that is what you want — actually change the project. This inspection concerns the Cabinet’s data and geometry; it does not replace a structural assessment of a building or a check against building regulations."] },
    ] },
    { heading: "“Check”, “propose” and “apply”", paragraphs: [
      "You do not need to know the names of WebMCP tools. It matters more to tell the agent what you expect it to do.",
    ], subsections: [
      { heading: "Check", paragraphs: [quote("Check whether someone can get from here to the exit without passing through the private zone."), "The agent reads the data and presents a result or analysis without needing to change anything."] },
      { heading: "Propose", paragraphs: [quote("Save a better layout for this wing as a proposal, but do not apply it yet."), "The agent can prepare a variant for you to inspect before making the change. Check that the proposal appears among the saved versions at the end of the Inspector."] },
      { heading: "Apply", paragraphs: [quote("Good. Accept this proposal."), "Only accepting the saved proposal changes the working project."] },
      { heading: "An important distinction", paragraphs: ["These words help the agent choose how to work, but they are not a technical lock. For an important change, explicitly ask the agent to save a proposal without applying it and check that it really appears among the saved versions."] },
    ] },
    { heading: "Proposals and safe experiments", paragraphs: [
      styled("The agent can save a prepared change as a ", { text: "proposal", emphasis: "strong" }, " instead of applying it to the project immediately."),
      "You can then inspect the proposed state and decide whether to accept it. For supported Story data, the Cabinet shows more detailed differences between values, their sources and conflicts. For map changes, the tracing of the proposed state and the combined description of the scope of the change are the most important parts.",
      "If the project changes in the meantime, the old proposal may be marked as out of date.",
      "For larger changes, the agent can also perform a series of connected operations as one whole and one step in history.",
    ] },
    { heading: "Undo, Redo and saved versions", paragraphs: [
      "Reversible changes made by the agent use the editor’s history just like your own operations.",
      styled({ text: "Undo", emphasis: "strong" }, " and ", { text: "Redo", emphasis: "strong" }, " let you step back and forth through current changes during the same open project session. This history is not a permanent archive and may disappear after reloading or reopening the project."),
      styled("If you need a more durable return point, use ", { text: "saved project versions", emphasis: "strong" }, ". Before some larger or riskier agent changes, the Cabinet may also create a safety tracing: a saved state of the project from before the operation."),
      "Objects locked against editing are also protected from changes made by the agent.",
      "The agent has tools for permanently deleting projects and saved versions. These operations have two stages, but the Cabinet does not require a person to confirm the second stage, and completed deletion remains permanent. Request these operations consciously and only from an agent you trust.",
    ] },
    { heading: "What can the agent see from your current work?", paragraphs: [
      styled("The Cabinet can also give the agent ", { text: "editor context", emphasis: "strong" }, ": the map currently open, the selection, the working mode, the active instrument, lenses, scenario and route."),
      "This means selecting an object can make the conversation easier. You can click a building and say:",
      quote("What do you think of this?"),
      "or:",
      quote("Move this closer to the road."),
      "The agent can check what is selected.",
      styled("The selection is ", { text: "conversation context, not an access boundary", emphasis: "strong" }, ". A connected agent can also use other project and Library data if it calls the tools provided for that purpose."),
    ] },
    { heading: "Connecting an agent", paragraphs: [
      "For ordinary manual work, the Cabinet does not need an agent or WebMCP.",
      "For an agent to use the project tools, the Cabinet must be open in a browser and agent environment that support WebMCP. The exact way of sharing the page depends on the product you use and may change as browsers develop.",
      styled("You can find current information in the ", { text: "WebMCP Challenge resources", href: "https://webmcp.devpost.com/resources", emphasis: "strong" }, " and the ", { text: "Chrome for Developers documentation", href: "https://developer.chrome.com/docs/ai/agents", emphasis: "strong" }, "."),
      "A basic trial works like this:",
    ], steps: [
      "Open the Cabinet in an environment that supports WebMCP.",
      "Open the project you want to work on.",
      "Check the WebMCP panel at the bottom of the application.",
      "Give your agent access to the open page in the way required by its environment.",
      styled("Ask: ", { text: "“Use the Cartographer’s Cabinet tools to read the name and structure of the open project.”", emphasis: "em" }),
    ], subsections: [
      { heading: "What the WebMCP panel means", paragraphs: [
        "The panel shows whether the browser exposes WebMCP, how many tools have been registered, whether errors occurred and whether the WebMCP host successfully called one of the page tools.",
        "Successful registration means only that the Cabinet prepared the tools for the host environment. It does not yet prove that a particular agent can see this tab. If you have just asked the agent to read the project, a successful call is practical confirmation that the connection is working.",
      ] },
    ] },
    { heading: "Privacy", paragraphs: [
      styled("Cabinet projects are stored ", { text: "locally in the browser", emphasis: "strong" }, ". The Cabinet itself does not send them to Varéra or Cloudflare."),
      "Working with an external agent changes the situation: to answer a question about the project, the agent must receive the data it reads. Information given to the agent is also governed by its provider’s terms.",
      "A narrower task may use less data, but the scope of your request is not a technical access boundary. A connected agent can call tools that read a broader part of the open project, as well as tools for the Project Library.",
      "Use an agent and provider you trust. Before working with a sensitive project, check the provider’s privacy terms.",
    ] },
    { heading: "Your first five minutes with an agent", paragraphs: ["The easiest way to understand this collaboration is simply to try it."], steps: [
      styled({ text: "Open an existing project.", emphasis: "strong" }, " It does not need to be elaborate."),
      styled({ text: "Ask the agent:", emphasis: "strong" }, " “Inspect my project and describe its structure.”"),
      styled({ text: "Select part of the project and ask:", emphasis: "strong" }, " “What can you tell me about this place and its surroundings?”"),
      styled({ text: "Move on to designing together:", emphasis: "strong" }, " “Save one change that would improve this part as a proposal. Do not apply it yet.”"),
      styled({ text: "If you like the proposal:", emphasis: "strong" }, " “Good. Accept this proposal.”"),
      styled({ text: "Treat the project as the setting of a story:", emphasis: "strong" }, " “What kind of scene could unfold interestingly in this part of the map? Base your answer on the project data.”"),
    ], subsections: [
      { heading: "The complete flow", paragraphs: [styled({ text: "idea → structured world → collaborative editing → analysis → a story set in the same world", emphasis: "strong" })] },
    ] },
    { heading: "The Cabinet as the world’s memory", paragraphs: [
      "Language agents are excellent at working with ideas, but a long conversation about a complex space quickly accumulates hundreds of details: where every room is, who has the key, which doors are secret, which road leads to the harbour, where a district ends, who owns a building and what changed during a particular event.",
      styled("The Cabinet keeps that knowledge ", { text: "structured and editable", emphasis: "strong" }, ". The agent can return to it."),
      "That is why you are not merely drawing a map of a world.",
      styled({ text: "You are creating a world that you can later discuss with an agent.", emphasis: "strong" }),
    ] },
    { heading: "For the technically curious: agent tools", paragraphs: [
      "The Cabinet exposes tools for reading projects, editing maps, working with construction and Story, routes, intentions, history, versions, the Project Library and batch operations.",
      "The WebMCP panel at the bottom of the application shows the current number of successfully registered tools. You do not need to know their technical names to work with an agent.",
    ] },
  ],
};
