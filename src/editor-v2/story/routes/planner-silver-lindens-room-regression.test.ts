import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProjectFile } from "../../persistence/project-file";
import { endpointForOption, storyRouteEndpointOptions } from "./endpoints";
import { findStoryRoutes } from "./planner";

const source = fs.readFileSync(path.join(process.cwd(), "public/examples/residence-of-the-silver-lindens.cartographer.json"), "utf8");

describe("Silver Lindens room route regression", () => {
  it("finds Pantry to Music Salon without an actor or scenario", () => {
    const project = parseProjectFile(source).project;
    const options = storyRouteEndpointOptions(project);
    const pantry = options.find(({ name }) => name === "Pantry");
    const musicSalon = options.find(({ name }) => name === "Music Salon");

    expect(pantry).toBeDefined();
    expect(musicSalon).toBeDefined();
    const result = findStoryRoutes(project, {
      from: endpointForOption(pantry!),
      to: endpointForOption(musicSalon!),
      profile: "foot",
    });

    expect(result.status, result.reasons.join("\n")).toBe("ready");
    expect(result.routes).toHaveLength(1);
  }, 10_000);
});
