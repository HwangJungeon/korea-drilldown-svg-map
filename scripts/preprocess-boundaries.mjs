import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outputIndex = args.indexOf("--output");
const inputPath = resolve(
  process.cwd(),
  inputIndex >= 0 ? args[inputIndex + 1] : process.env.BOUNDARY_SOURCE_PATH ?? "HangJeongDong_ver20260201.geojson",
);
const outputRoot = resolve(
  process.cwd(),
  outputIndex >= 0 ? args[outputIndex + 1] : resolve(projectRoot, "data", "boundaries"),
);
const tempRoot = resolve(projectRoot, ".tmp", "boundaries");
const mapshaperBin = process.platform === "win32"
  ? resolve(projectRoot, "node_modules", ".bin", "mapshaper.cmd")
  : resolve(projectRoot, "node_modules", ".bin", "mapshaper");

if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  console.error("Provide --input <path> or set BOUNDARY_SOURCE_PATH.");
  process.exit(1);
}

if (!existsSync(mapshaperBin)) {
  console.error("mapshaper binary not found. Run `pnpm add -D mapshaper` first.");
  process.exit(1);
}

rmSync(tempRoot, { recursive: true, force: true });
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(tempRoot, { recursive: true });
mkdirSync(outputRoot, { recursive: true });

const source = JSON.parse(readFileSync(inputPath, "utf8"));
const metadata = buildRegionMetadata(source.features);

writeJson(resolve(outputRoot, "regions.json"), metadata);

buildTopology({
  inputPath,
  label: "dong/all.topo.json",
  outputFile: resolve(outputRoot, "dong", "all.topo.json"),
  precision: "0.00001",
  steps: [
    "-clean",
    "-rename-fields",
    "code=adm_cd,name=adm_nm,code10=adm_cd2,sidoCode=sido,sidoName=sidonm,sggCode=sgg,sggName=sggnm",
    "-each",
    "level='dong',label=name",
    "-simplify",
    "weighted",
    "percentage=6%",
    "keep-shapes",
  ],
});

buildTopology({
  inputPath,
  label: "sgg/all.topo.json",
  outputFile: resolve(outputRoot, "sgg", "all.topo.json"),
  precision: "0.00005",
  steps: [
    "-clean",
    "-dissolve2",
    "sgg",
    "copy-fields=sgg,sggnm,sido,sidonm",
    "-rename-fields",
    "code=sgg,name=sggnm,sidoCode=sido,sidoName=sidonm",
    "-each",
    "level='sgg',label=sidoName + ' ' + name",
    "-simplify",
    "weighted",
    "percentage=18%",
    "keep-shapes",
  ],
});

for (const sido of metadata.sido) {
  buildTopology({
    inputPath,
    label: `sgg/by-sido/${sido.code}.topo.json`,
    outputFile: resolve(outputRoot, "sgg", "by-sido", `${sido.code}.topo.json`),
    precision: "0.00005",
    steps: [
      "-filter",
      `sido == '${sido.code}'`,
      "-clean",
      "-dissolve2",
      "sgg",
      "copy-fields=sgg,sggnm,sido,sidonm",
      "-rename-fields",
      "code=sgg,name=sggnm,sidoCode=sido,sidoName=sidonm",
      "-each",
      "level='sgg',label=sidoName + ' ' + name",
      "-simplify",
      "weighted",
      "percentage=10%",
      "keep-shapes",
    ],
  });
}

buildTopology({
  inputPath,
  label: "sido/all.topo.json",
  outputFile: resolve(outputRoot, "sido", "all.topo.json"),
  precision: "0.0001",
  steps: [
    "-clean",
    "-dissolve2",
    "sido",
    "copy-fields=sido,sidonm",
    "-rename-fields",
    "code=sido,name=sidonm",
    "-each",
    "level='sido',label=name",
    "-simplify",
    "weighted",
    "percentage=30%",
    "keep-shapes",
  ],
});

console.log("");
console.log("Generated boundary assets:");
printDirectory(outputRoot);

function buildTopology({ inputPath, label, outputFile, precision, steps }) {
  console.log(`\n[mapshaper] building ${label}...`);

  const tempDir = resolve(tempRoot, label.replaceAll("/", "__").replaceAll(".", "_"));
  const outputDir = dirname(outputFile);

  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const result = spawnSync(
    mapshaperBin,
    [
      inputPath,
      ...steps,
      "-proj",
      "wgs84",
      "-rename-layers",
      "regions",
      "-o",
      "force",
      "format=topojson",
      `precision=${precision}`,
      tempDir,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  if (result.stdout.trim()) {
    process.stdout.write(`${result.stdout.trim()}\n`);
  }

  if (result.status !== 0) {
    if (result.stderr.trim()) {
      process.stderr.write(`${result.stderr.trim()}\n`);
    }
    process.exit(result.status ?? 1);
  }

  const generatedJsonFiles = readdirSync(tempDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(tempDir, entry));

  if (generatedJsonFiles.length !== 1) {
    console.error(`Expected one TopoJSON file for ${label}, found ${generatedJsonFiles.length}.`);
    process.exit(1);
  }

  rmSync(outputFile, { force: true });
  renameSync(generatedJsonFiles[0], outputFile);
}

function buildRegionMetadata(features) {
  const sidoMap = new Map();
  const sggMap = new Map();

  for (const feature of features) {
    const props = feature.properties ?? {};
    const sidoCode = String(props.sido ?? "");
    const sidoName = String(props.sidonm ?? "");
    const sggCode = String(props.sgg ?? "");
    const sggName = String(props.sggnm ?? "");

    if (!sidoMap.has(sidoCode)) {
      sidoMap.set(sidoCode, {
        code: sidoCode,
        name: sidoName,
      });
    }

    if (!sggMap.has(sggCode)) {
      sggMap.set(sggCode, {
        code: sggCode,
        name: sggName,
        sidoCode,
        sidoName,
      });
    }
  }

  const sido = [...sidoMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  const sgg = [...sggMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  return {
    source: inputPath.split("/").at(-1),
    generatedAt: new Date().toISOString(),
    counts: {
      sido: sido.length,
      sgg: sgg.length,
      dong: features.length,
    },
    sido: sido.map((region) => ({
      ...region,
      sggCount: sgg.filter((item) => item.sidoCode === region.code).length,
    })),
    sgg,
    sggBySido: Object.fromEntries(
      sido.map((region) => [
        region.code,
        sgg.filter((item) => item.sidoCode === region.code),
      ]),
    ),
  };
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function printDirectory(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const relativePath = absolutePath.replace(`${projectRoot}/`, "");

    if (entry.isDirectory()) {
      console.log(`${relativePath}/`);
      printDirectory(absolutePath);
      continue;
    }

    const size = statSync(absolutePath).size;
    console.log(`${relativePath} (${formatBytes(size)})`);
  }
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
