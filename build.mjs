import esbuild from "esbuild";
import { copyFile } from "node:fs/promises";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "node",
  target: "es2020",
  outfile: "main.js",
  minify: production,
  sourcemap: production ? false : "inline",
});

await copyFile("src/styles.css", "styles.css");
