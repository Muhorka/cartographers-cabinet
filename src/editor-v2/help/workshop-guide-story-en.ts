import type { WorkshopGuideTopic } from "./workshop-guide-model";
import { styled } from "./workshop-guide-model";

export const storyGuideTopicEn: WorkshopGuideTopic = {
  id: "story",
  title: "Describing the world and testing situations",
  summary: "How to add inhabitants, ownership and world rules, then use lenses, scenarios, routes and intentions.",
  sections: [
    { heading: "When the map alone is no longer enough", paragraphs: [
      styled("A drawn map tells you ", { text: "where things are and what the space looks like", emphasis: "strong" }, "."),
      "It can show a palace, a road through a forest, the arrangement of flats in a tenement building or a doorway between two rooms. It does not yet know who lives in those places, who owns them, who has the keys or whether a particular person is allowed through that door.",
      styled("That is what ", { text: "Story", emphasis: "strong" }, " mode is for."),
      "You do not need it if you simply want to draw maps. But if you want to examine your world as a working system — with inhabitants, ownership, access, events and routes — this is where you add information that geometry alone cannot express.",
      styled("When you switch to ", { text: "Story", emphasis: "strong" }, ", you are still looking at the same project and the same sheet. What changes most are the tools arranged around the map."),
    ] },
    { heading: "The World book — who and what exists in the project", paragraphs: [
      styled("In the book on the left, you will find the ", { text: "World book", emphasis: "strong" }, ". It holds things that do not need a shape of their own on the map, but still matter to what happens there."),
      "You can create, among other things:",
    ], bullets: [
      styled({ text: "Characters", emphasis: "strong" }, " — particular people who exist in the world."),
      styled({ text: "Factions", emphasis: "strong" }, " — families, organisations, guilds, institutions and other affiliations."),
      styled({ text: "People groups", emphasis: "strong" }, " — collections of characters who share a similar role, such as “Residents”, “Guards”, “Staff” or “Guests”."),
      styled({ text: "Keys", emphasis: "strong" }, " — objects or permissions assigned to passages as accepted keys, and to characters, factions or groups as keys they possess."),
      styled({ text: "Scenarios", emphasis: "strong" }, " — situations in which the world temporarily works differently from usual."),
      styled({ text: "Intentions", emphasis: "strong" }, " — the author's assumptions, which the Cabinet can later try to test."),
      styled({ text: "Relations", emphasis: "strong" }, " — descriptive connections between people, organisations, places and objects."),
    ] },
    { heading: "Characters, groups and factions", paragraphs: [
      "Suppose you are designing a large estate. You could create a character named Anna, who belongs to the Residents group, and another named Marek, who belongs to Staff.",
      "Groups can carry shared traits. This saves you from entering the same information separately for a dozen people.",
      "If every member of staff is allowed into the service area, select the Staff group in that place's access rule. A particular person can still have additional traits of their own, or be named as an exception in a place's access rule.",
      "Factions work in a similar way. A character might belong to a guild, family, company or city watch and inherit information that follows from that membership.",
      "The Cabinet will also show you when different groups pass conflicting values to the same person. The disagreement does not quietly disappear under the cartographer's desk.",
    ] },
    { heading: "Owners of places and objects", paragraphs: [
      "You can assign one or more owners to any place or object. An owner may be a character, faction or people group.",
      styled("If an entire house belongs to one person, you do not have to mark every room separately. Smaller places can ", { text: "inherit ownership from their parent place", emphasis: "strong" }, "."),
      "If the house belongs to Anna, its drawing room, kitchen and bedroom can automatically belong to Anna as well.",
      "If a shop inside the house belongs to someone else, however, you can give it an owner of its own and stop that inheritance.",
      "In the Story Inspector, you can see both owners assigned directly to the selected item and owners inherited from its parent place.",
    ] },
    { heading: "Traits — your own vocabulary for information", paragraphs: [
      "Not every world needs the same information. In a crime story, it might matter whether a room is under surveillance. In a fantasy game, whether the land is tainted by magic. When designing a city, you may need population, building type or threat level.",
      styled("That is why the Cabinet lets you create your own ", { text: "traits", emphasis: "strong" }, ". A trait can store:"),
    ], bullets: ["text", "a number", "a number with a unit", "a yes / no answer", "one choice from a list", "several choices", "a link to another entry in the project"], subsections: [
      { heading: "Example", paragraphs: ["You could create Heated as a Yes/No trait, Population as a number, or Room function as a choice from a prepared list. Once created, a trait can be used in many places throughout the project."] },
    ] },
    { heading: "Zones — grouping places by meaning", paragraphs: [
      styled("A ", { text: "Zone", emphasis: "strong" }, " lets you gather several existing places or objects that you want to treat as a whole for some reason. They do not need to form a separate level in the Atlas, or even lie next to one another."),
      "For example, you could create:",
    ], bullets: [
      "a private zone containing bedrooms and a study",
      "a staff area containing the kitchen, store room and utility room",
      "a flood zone made from selected green areas already drawn beside the river",
      "a suite or flat containing several rooms on one floor",
      "a city district made from existing places and objects that belong to that part of the city",
    ], subsections: [
      { heading: "Zones and the Atlas", paragraphs: [
        "A city can exist in the Atlas as one map level, while its Old Town, harbour, industrial and villa districts can be zones grouping elements on that same map.",
        "Likewise, one floor of a tenement building can be a single sheet, with its individual flats marked as separate zones.",
        "One object can belong to more than one zone at the same time. A room might belong both to “Flat 4” and to the “Private zone”. A zone can also have traits of its own, inherited by the elements it contains.",
      ] },
    ] },
    { heading: "Lenses — look at the map from another angle", paragraphs: [
      styled("As a project grows, reading every piece of information in the Inspector becomes inconvenient. That is what ", { text: "Lenses", emphasis: "strong" }, " are for."),
      "A lens reads information stored in the project and highlights things on the map that meet selected conditions. You can ask the Cabinet to show:",
    ], bullets: [
      "everything owned by a particular person",
      "places whose access rules allow a selected person or group",
      "objects for which a particular trait has a selected value",
      "an entire selected zone",
      "several particular objects",
    ], subsections: [
      { heading: "Examples", paragraphs: [
        "A Guest access lens can show places whose access rules admit the Guests group. It does not calculate a route or check locks and possessed keys — route planning does that.",
        "A Historic objects lens can highlight everything for which the Historic trait is set to Yes.",
        "Conditions can be combined. You can require every condition or at least one of them. You can also reverse a condition, for example to show everything that is not part of a particular zone.",
        "You can preview a lens temporarily or save it under a name and return to it later. Several lenses can also be active at once.",
      ] },
    ] },
    { heading: "Access — who is actually allowed in?", paragraphs: [
      styled("A door may exist physically on the map, but in Story mode you can describe ", { text: "how it works for the inhabitants of the world", emphasis: "strong" }, ". For a place or passage, you can specify, among other things:"),
    ], bullets: [
      "access for everyone, selected characters or groups, or no access at all",
      "people who are exceptions to the rule",
      "whether a passage is open or closed and whether it has a lock",
      "which keys it accepts and who possesses those keys",
      "whether a guard watches the place",
    ], subsections: [
      { heading: "Secret passages", paragraphs: ["You can mark a secret passage and record which characters know that it exists. This matters when planning routes: a character should not take a shortcut through a secret corridor merely because you, the author, can see it on the plan."] },
    ] },
    { heading: "Keys", paragraphs: [
      "You create a key once in the World book. You can then assign it to passages that accept it, and to characters, factions and people groups that possess it.",
      "One key can open several passages, and one door can accept more than one key.",
      "Instead of writing “Anna may enter” on every door, you describe the actual mechanism: Anna has the key → the door accepts that key → Anna can use the door.",
      "If you later take the key away from her, you do not need to edit every door that it opened.",
    ] },
    { heading: "Routes — can someone really get from A to B?", paragraphs: [
      styled("Once the map has geometry and some basic Story rules, the Cabinet can try to find a ", { text: "real route for a particular traveller", emphasis: "strong" }, "."),
      "Choose a starting point, a destination and — when it matters — a character, faction or people group. The Cabinet then considers more than distance, including:",
    ], bullets: ["walls and passages", "doors", "stairs and lifts", "successive floors", "roads", "access rights", "locks and keys", "the method of travel"], subsections: [
      { heading: "Travel settings", paragraphs: [
        "You can look for a route on foot, on horseback or by vehicle. For outdoor routes, you can allow or forbid travel away from roads; for openings through walls, you can decide whether windows may be used.",
        "The start and destination can be existing places, drawn terrain objects or exact points chosen directly on the map. If several sensible possibilities exist, the Cabinet can suggest up to three alternatives.",
        "If a guard is recorded for part of the route, the Cabinet may report that the guard's condition still needs to be resolved. Such a case may require the author's judgement.",
      ] },
    ] },
    { heading: "Example: the door is close, but that does not mean you can pass through it", paragraphs: [
      "Suppose Anna is in the entrance hall and wants to reach the archive. The shortest route leads through a locked door.",
      "Anna does not have the right key, but a longer route exists through a corridor open to everyone. The Cabinet can reject the first passage and guide Anna along the second route.",
      "If no legal route exists, you will be told that the destination cannot be reached — instead of receiving a convenient line drawn through the nearest wall.",
      "This is where the geometry of Drawing meets the rules of Story.",
    ] },
    { heading: "Saving routes", paragraphs: [
      styled("You can simply view a calculated route, or ", { text: "save it under your own name", emphasis: "strong" }, ". This is useful when you regularly return to the same journey, such as “Guest entrance”, “Delivery route” or “Evacuation route”."),
      "The Cabinet remembers the state of the project from which it was calculated. If you move a wall, close a door or change an access rule, the old result may be marked as out of date. You can then calculate the route again.",
      "When checking an intention, a saved route acts like a saved question: it remembers the start, destination, traveller and settings. The Cabinet does not treat its old path as evidence — it calculates the route again for the current map, scenario and step.",
    ] },
    { heading: "Scenarios — when the world temporarily works differently", paragraphs: [
      "Not every rule in the world lasts forever. A door may normally be open but locked during an alarm. A room may usually belong to the residents but be opened to guests during a reception. A passage may be blocked while repairs are under way.",
      styled("These situations are described with ", { text: "Scenarios", emphasis: "strong" }, ". A scenario represents an alternative state of the world without destroying its ordinary data."),
      "For example, you could create Reception, Fire, Night or West wing repairs and specify what changes in each situation.",
    ] },
    { heading: "Scenario steps", paragraphs: [
      "A scenario can contain several steps if the situation changes over time. A Fire scenario could have the steps Fire detected, Part of the building closed and Evacuation.",
      "Each step can have effects of its own. You can also add a change that applies throughout the entire scenario, regardless of the selected step.",
      "On the Story top bar, choose the scenario and the step you want to view.",
    ] },
    { heading: "Describing an event does not change the world by itself", paragraphs: [
      "If you write “Security closes the north wing” in a scenario, it remains a description for you.",
      styled("For the Cabinet to understand its consequences, you must add an ", { text: "effect", emphasis: "strong" }, " to the relevant places or objects."),
      "You could select the appropriate doors and make them closed in this scenario, or change the access rules for that part of the building. This keeps the description readable for a person while making its consequences understandable to the program.",
    ] },
    { heading: "Base world, or only this scenario?", paragraphs: [
      styled("While a scenario is active, the Cabinet lets you choose ", { text: "where a change should be saved", emphasis: "strong" }, "."),
      styled({ text: "Edit base", emphasis: "strong" }, " changes the project's ordinary, underlying state."),
      styled({ text: "Edit scenario", emphasis: "strong" }, " makes the change apply only to the selected scenario or step. When a step is active, the change belongs to that step; without a selected step, it applies throughout the scenario."),
      "If you discover that a door should always be locked, correct the base world. If it should be locked only during an alarm, save the change in the scenario.",
    ] },
    { heading: "Author intentions — “this ought to work”", paragraphs: [
      styled("Sometimes you do not yet care about the exact answer. What you know is ", { text: "what should be possible in the world you are designing", emphasis: "strong" }, ". Use Author intentions to record requirements like these."),
      "For example: “A guest should be able to reach the conference room from the entrance”, “The delivery route must pass through the store room”, “The evacuation route must not enter the closed zone” or “Technical staff must have access to the boiler room”.",
      "The authoring status says whether an intention is a Draft, an Accepted requirement or a Rejected idea. It is not the result of an automatic check.",
    ] },
    { heading: "What can be checked automatically", paragraphs: ["An intention can concern, among other things:"], bullets: [
      styled({ text: "Reachability", emphasis: "strong" }, " — whether the destination can be reached."),
      styled({ text: "Must pass", emphasis: "strong" }, " — whether the calculated route goes through a particular place."),
      styled({ text: "Avoid zone", emphasis: "strong" }, " — whether the calculated route avoids a particular zone area."),
      styled({ text: "Access rule", emphasis: "strong" }, " — whether a particular character, faction or people group has permission to enter."),
      styled({ text: "Custom intention", emphasis: "strong" }, " — a requirement left for human judgement."),
    ], subsections: [
      { heading: "Limits of the check", paragraphs: ["A route-path check evaluates one freshly calculated route, not every possible route. Automatically checking whether a zone is avoided requires that zone to have an area defined on the map."] },
    ] },
    { heading: "Check scene intentions", paragraphs: [
      styled("When you want to find out whether the world behaves as intended, run ", { text: "Check scene intentions", emphasis: "strong" }, "."),
      "You can check intentions connected to the current selection or intentions from across the project. For a very broad scope, the report may cover only part of it and ask you to narrow it down.",
      "The Cabinet can check an access rule without planning a route. Route intentions need a saved route with a suitable start and destination. Its points and settings are used for a fresh calculation in the current scenario and step. If you do not yet have a suitable route, choose Prepare a route, calculate and save it, then return to the check.",
      "The result is not limited to a simple “yes” or “no”. You may see:",
    ], bullets: [
      styled({ text: "Satisfied", emphasis: "strong" }, " — everything works as intended."),
      styled({ text: "Conditional", emphasis: "strong" }, " — it works, but depends on particular circumstances."),
      styled({ text: "Not satisfied", emphasis: "strong" }, " — the current world contradicts the intention."),
      styled({ text: "Missing facts", emphasis: "strong" }, " — the Cabinet does not have enough information."),
      styled({ text: "Author review needed", emphasis: "strong" }, " — the question cannot sensibly be settled automatically."),
    ], subsections: [
      { heading: "The report", paragraphs: ["The result can show the evidence used, missing information and conflicts. A report changes nothing by itself: it does not change the intention's authoring status or save the result as a new world rule."] },
    ] },
    { heading: "Returning to the ordinary world", paragraphs: [
      "While you work, you can have lenses, a scenario, a particular step and a route visible at the same time.",
      styled("If the map begins to contain more coloured information than map, choose ", { text: "Restore base view", emphasis: "strong" }, "."),
      "The Cabinet will turn off the active previews and show the project's ordinary state. It does not delete saved lenses, routes or scenarios.",
    ] },
    { heading: "The simplest way to begin using Story", paragraphs: [
      "Do not try to describe an entire society, its ownership system and four hundred keys to the castle all at once. Start with a small experiment:",
    ], steps: [
      "Create one character.",
      "Choose a place on the map and assign an owner to it.",
      "Create a people group and add the character to it.",
      "Set an access rule for one room.",
      "If it has lockable doors, create a key and give it to the character.",
      "Ask the Cabinet to find a route to the room.",
    ], subsections: [
      { heading: "What just happened?", paragraphs: [
        styled("Information recorded separately ", { text: "begins to work together", emphasis: "strong" }, "."),
        styled("The map tells the Cabinet where physical movement is possible. Story tells it who is allowed to go there. Only the two together can answer the question: ", { text: "“Can this particular traveller really reach that place?”", emphasis: "strong" }),
      ] },
    ] },
  ],
};
