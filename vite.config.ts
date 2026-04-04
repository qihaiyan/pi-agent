import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    ssr: true,
    lib: {
      entry: {
        main: "src/main.ts",
        index: "src/index.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        /^@mariozechner\//,
      ],
    },
  },
});
