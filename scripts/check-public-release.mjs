import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/u)
  .filter(Boolean);
const trackedSet = new Set(tracked);

const required = [
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "public/THIRD_PARTY_NOTICES.md",
  "public/fonts/gelasio/OFL.txt",
  "public/_headers",
  "src/app/page.tsx",
  "src/editor-v2/webmcp/register-editor-tools.ts",
];

const forbiddenPaths = [
  /(^|\/)AGENTS\.md$/u,
  /(^|\/)\.private(\/|$)/u,
  /(^|\/)(node_modules|\.next|out|output|coverage|exports|generated)(\/|$)/u,
  /(^|\/)(private-projects|user-projects)(\/|$)/u,
  /^src\/(components|domain|editor|export|i18n|persistence|webmcp)(\/|$)/u,
  /^docs\/(editor-v2-(audit|status|parity|visual-audit)|story-v2-plan|hackathon-scope).*\.md$/u,
];

const missing = required.filter((path) => !trackedSet.has(path));
const forbidden = tracked.filter((path) => forbiddenPaths.some((pattern) => pattern.test(path)));

const textFiles = tracked.filter((path) =>
  /\.(?:css|html|js|json|jsx|md|mjs|toml|ts|tsx|txt|yaml|yml)$/u.test(path)
  && path !== ".gitignore"
  && path !== "scripts/check-public-release.mjs"
  && !path.startsWith("public/licenses/"),
);
const privateMarkers = /C:\\Users\\|Dw[oó]r Rueve|Muhorka|zakli|\.private\/development-log/iu;
const secretMarkers = /BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|SUPABASE_SERVICE_ROLE|(?:DATABASE_URL|API_KEY|SECRET|TOKEN)\s*=/u;
const sensitive = textFiles.filter((path) => {
  const contents = readFileSync(path, "utf8");
  return privateMarkers.test(contents) || secretMarkers.test(contents);
});

const license = readFileSync("LICENSE", "utf8");
const rootNotices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
const publicNotices = readFileSync("public/THIRD_PARTY_NOTICES.md", "utf8");
const rootPage = readFileSync("src/app/page.tsx", "utf8");
const readme = readFileSync("README.md", "utf8");

const failures = [];
if (missing.length) failures.push(`Missing required tracked files:\n${missing.join("\n")}`);
if (forbidden.length) failures.push(`Forbidden public paths:\n${forbidden.join("\n")}`);
if (sensitive.length) failures.push(`Review possible private or secret content:\n${sensitive.join("\n")}`);
if (!license.startsWith("MIT License\n\nCopyright (c) 2026 Varéra and contributors")) failures.push("Root LICENSE is not the approved MIT text/holder.");
if (rootNotices !== publicNotices) failures.push("Root and public third-party notices differ.");
if (!rootPage.includes("@/editor-v2/components/editor-workbench") || rootPage.includes("@/components/workshop")) failures.push("The root route is not bound exclusively to the current editor.");
if (!readme.includes("document.modelContext.registerTool({")) failures.push("README lacks the official WebMCP registration shape.");

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log(`Public release boundary passed for ${tracked.length} tracked files.`);
}
