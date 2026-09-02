import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// KesslerShield // LEO — Vite configuration.
// Keeps three.js in its own chunk so the initial telemetry HUD paints fast.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          vendor: ["react", "react-dom", "zustand"],
        },
      },
    },
  },
});
