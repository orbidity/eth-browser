import { build } from "esbuild";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

await build({
  logLevel: "info",
  entryPoints: ["./src/worker.js"],
  bundle: true,
  watch: true,
  platform: "browser",
  target: "esnext",
  outdir: "./dist",
  loader: { ".sol": "text" },
  plugins: [NodeModulesPolyfillPlugin()],
});
