import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(demoRoot, "..", "..");

run("pnpm", ["--dir", packageRoot, "build"], "패키지 빌드");

function run(command, args, label, cwd = demoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`${label}에 실패했습니다.`);
    process.exit(result.status ?? 1);
  }
}
