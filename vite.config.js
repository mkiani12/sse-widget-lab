import { defineConfig } from "vite";
export default defineConfig({
  root: "dev", // serve dev/ as web root
  server: { port: 5173 },
  build: { outDir: "../dist" },
});
