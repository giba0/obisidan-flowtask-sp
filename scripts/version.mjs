import { readFile, writeFile } from "node:fs/promises";

const kind = process.argv[2];
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error('Usage: npm run version:patch|version:minor|version:major');
  process.exit(1);
}

const packagePath = "package.json";
const lockPath = "package-lock.json";
const manifestPath = "manifest.json";
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const versionParts = packageJson.version.split(".").map(Number);
if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) throw new Error(`Invalid version: ${packageJson.version}`);

if (kind === "major") { versionParts[0] += 1; versionParts[1] = 0; versionParts[2] = 0; }
if (kind === "minor") { versionParts[1] += 1; versionParts[2] = 0; }
if (kind === "patch") versionParts[2] += 1;

const version = versionParts.join(".");
packageJson.version = version;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = version;
const lock = JSON.parse(await readFile(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Version bumped to ${version}`);
