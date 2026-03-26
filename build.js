const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const entryPoints = ["src/content.ts", "src/popup.ts", "src/background.ts"];

const buildOptions = {
  entryPoints,
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome110",
  sourcemap: false,
};

if (watch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log("Build complete.");
  });
}
