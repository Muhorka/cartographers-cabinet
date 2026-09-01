import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { createContext, runInContext } from "node:vm";

const staticRoot = join("out", "_next", "static");

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function routeProject(id, name) {
  return {
    schemaVersion: 9,
    id,
    name,
    updatedAt: "1970-01-01T00:00:00.000Z",
    places: [],
    elements: [],
    surfaces: [],
    constructions: [],
    measureSettings: {
      units: "metric",
      gridVisible: false,
      showAxes: false,
      gridOpacity: 0.18,
      gridSpacingMeters: 1,
      snapToGrid: false,
      showRoomAreas: false,
      pencilSmoothing: 0.25,
    },
    roadJunctions: [],
    story: {
      version: 1,
      world: [],
      memberships: [],
      propertyDefinitions: [],
      objects: [],
      groups: [],
      zones: [],
      lenses: [],
      scenarios: [],
      relations: [],
      intentions: [],
      evidence: [],
      routes: [],
    },
  };
}

function denseOutdoorRouteProject() {
  const project = routeProject("qa-route-outdoor-grid-v1", "QA route outdoor grid");
  const worldId = "qa:route:world";
  project.places.push({
    id: worldId,
    name: "QA grounds",
    kind: "world",
    transform: { x: 0, y: 0, rotation: 0 },
    boundary: { kind: "rectangle", x: 0, y: 0, width: 240, height: 160 },
    tags: [],
    access: [],
    properties: {},
  });
  project.elements = [20, 71, 122].flatMap((y, row) => Array.from({ length: 8 }, (_, column) => ({
    id: `qa:barrier:r${row}:c${column}`,
    belongsToId: worldId,
    name: `Barrier ${row + 1}.${column + 1}`,
    layerId: "terrain",
    subjectId: "terrain.wall",
    geometry: { kind: "region", shape: { kind: "rectangle", x: 25 + 25 * column, y, width: 18, height: 18 } },
    visible: true,
    locked: false,
    tags: ["wall"],
    access: [],
    properties: {},
  })));
  return project;
}

async function executeRouteWorkerArtifact(workerPath, chunksPath) {
  const workerSource = readFileSync(workerPath, "utf8");
  const messages = [];
  const chunksRoot = resolve(chunksPath);
  let vmContext;

  function loadWorkerDependency(url) {
    const parsed = new URL(String(url), "https://route-worker-artifact.invalid");
    if (parsed.origin !== "https://route-worker-artifact.invalid") {
      throw new Error(`Worker dependency escaped origin: ${parsed.origin}`);
    }
    const prefix = "/_next/static/chunks/";
    if (!parsed.pathname.startsWith(prefix)) {
      throw new Error(`Worker dependency escaped chunks directory: ${parsed.pathname}`);
    }
    const name = parsed.pathname.slice(prefix.length);
    if (!/^[A-Za-z0-9._-]+[.]js$/u.test(name) || name.includes("..")) {
      throw new Error(`Unsafe Worker dependency name: ${name}`);
    }
    const dependencyPath = resolve(chunksRoot, name);
    if (!dependencyPath.toLowerCase().startsWith(`${chunksRoot.toLowerCase()}${sep}`)) {
      throw new Error(`Worker dependency escaped filesystem root: ${name}`);
    }
    if (!existsSync(dependencyPath)) throw new Error(`Missing Worker dependency: ${name}`);
    runInContext(readFileSync(dependencyPath, "utf8"), vmContext, { filename: dependencyPath });
  }

  const sandbox = {
    console,
    URL,
    structuredClone,
    setTimeout,
    clearTimeout,
    postMessage: (message) => messages.push(message),
    importScripts: (...urls) => urls.forEach(loadWorkerDependency),
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vmContext = createContext(sandbox);

  runInContext(workerSource, vmContext, { filename: workerPath });
  await new Promise((done) => setImmediate(done));
  if (typeof vmContext.onmessage !== "function") {
    throw new Error("Compiled route Worker did not install onmessage.");
  }

  async function calculate(attemptId, project, query) {
    const before = messages.length;
    vmContext.onmessage({ data: { type: "calculate", attemptId, project, query } });
    await new Promise((done) => setImmediate(done));
    const responses = messages.slice(before);
    if (responses.length !== 1) {
      throw new Error(`Expected exactly one Worker response for attempt ${attemptId}, got ${responses.length}.`);
    }
    return responses[0];
  }

  const message = await calculate(17, routeProject("route-worker-artifact-test", "Route worker artifact test"), {
    from: { placeId: "missing", point: { x: 0, y: 0 } },
    to: { placeId: "missing", point: { x: 1, y: 1 } },
  });
  if (message?.type !== "result" || message.attemptId !== 17 || message.result?.status !== "unreachable") {
    throw new Error(`Unexpected Worker response: ${JSON.stringify(message)}`);
  }

  const dense = await calculate(18, denseOutdoorRouteProject(), {
    from: { placeId: "qa:route:world", point: { x: 8, y: 80 } },
    to: { placeId: "qa:route:world", point: { x: 232, y: 80 } },
    profile: "foot",
    width: 0.8,
    preferences: { preferRoads: false, allowOffroad: true },
  });
  const route = dense?.result?.route;
  if (dense?.type !== "result" || dense.attemptId !== 18 || dense.result?.status !== "ready"
    || dense.result.routes?.length !== 1 || route?.segments?.length !== 1 || route.segments[0]?.kind !== "outdoor"
    || route.distance <= 224 || route.distance >= 260
    || route.points?.[0]?.x !== 8 || route.points?.[0]?.y !== 80
    || route.points?.at(-1)?.x !== 232 || route.points?.at(-1)?.y !== 80) {
    throw new Error(`Unexpected dense Worker response: ${JSON.stringify(dense)}`);
  }
}

const failures = [];
if (!existsSync(staticRoot)) {
  failures.push(`Missing production assets directory: ${staticRoot}`);
}

const files = failures.length ? [] : filesBelow(staticRoot);
const scripts = files.filter((path) => extname(path) === ".js");
const leakedSources = files.filter((path) => {
  if (!/[.]tsx?$/u.test(path)) return false;
  const source = readFileSync(path, "utf8");
  return source.includes("findStoryRoutes") || source.includes("RouteWorkerRequest") || source.includes("import type");
});

const clientArtifact = scripts.find((path) => {
  const source = readFileSync(path, "utf8");
  return source.includes("new Worker") && source.includes("Route worker is unavailable in this browser.");
});
let workerArtifact;

if (clientArtifact) {
  const clientSource = readFileSync(clientArtifact, "utf8");
  const routeLauncherAt = clientSource.indexOf("Route worker is unavailable in this browser.");
  const routeLauncher = clientSource.slice(routeLauncherAt, routeLauncherAt + 700);
  const workerChunkId = routeLauncher.match(/new Worker[\s\S]*?[.]u\((\d+)\)/u)?.[1];
  if (!workerChunkId) {
    failures.push("The route Worker launcher does not reference a verifiable Webpack chunk.");
  } else {
    workerArtifact = scripts.find((path) => new RegExp(`^${workerChunkId}(?:[-.]).+[.]js$`, "u").test(basename(path)));
    if (!workerArtifact) failures.push(`The route Worker references missing chunk ${workerChunkId}.`);
  }
}

if (workerArtifact) {
  const workerSource = readFileSync(workerArtifact, "utf8");
  const workerMarkers = ["globalThis", "onmessage", "postMessage", "attemptId", "calculate"];
  const forbiddenTypeScript = ["import type", "type RouteWorkerRequest", " as unknown as "];
  if (!workerMarkers.every((marker) => workerSource.includes(marker))) {
    failures.push(`The referenced route Worker chunk lacks its runtime contract: ${relative(".", workerArtifact)}.`);
  }
  if (forbiddenTypeScript.some((marker) => workerSource.includes(marker))) {
    failures.push(`The referenced route Worker chunk contains uncompiled TypeScript: ${relative(".", workerArtifact)}.`);
  }
  const syntaxCheck = spawnSync(process.execPath, ["--check", workerArtifact], { encoding: "utf8" });
  if (syntaxCheck.status !== 0) {
    failures.push(`The referenced route Worker chunk is not valid JavaScript:\n${syntaxCheck.stderr.trim()}`);
  }
  try {
    await executeRouteWorkerArtifact(workerArtifact, join(staticRoot, "chunks"));
  } catch (error) {
    failures.push(`The referenced route Worker did not execute its production contract:\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
}

if (leakedSources.length) {
  failures.push(`Route Worker leaked as uncompiled TypeScript:\n${leakedSources.map((path) => relative(".", path)).join("\n")}`);
}
if (!clientArtifact) failures.push("The production client does not contain the route Worker launcher.");

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log(`Route Worker build passed: ${relative(".", workerArtifact)}.`);
}
