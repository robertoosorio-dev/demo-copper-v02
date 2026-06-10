import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@copper/contracts": resolve(__dirname, "../../packages/contracts/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
