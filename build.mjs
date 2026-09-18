import esbuild from "esbuild";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const css = await readFile("src/styles.css", "utf8");

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
  define: { __FLOWTASK_CSS__: JSON.stringify(css) },
});
