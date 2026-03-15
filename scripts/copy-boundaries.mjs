import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(projectRoot, "data", "boundaries");
const targetArgument = process.argv[2];

if (!targetArgument) {
  console.error("Usage: node ./scripts/copy-boundaries.mjs <target-directory>");
  process.exit(1);
}

if (!existsSync(sourceRoot)) {
  console.error(`Boundary source directory not found: ${sourceRoot}`);
  process.exit(1);
}

const targetRoot = resolve(process.cwd(), targetArgument);
mkdirSync(dirname(targetRoot), { recursive: true });
cpSync(sourceRoot, targetRoot, {
  recursive: true,
  force: true,
});

console.log(`Copied boundary assets to ${targetRoot}`);
