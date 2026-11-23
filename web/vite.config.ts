import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        animation: resolve(__dirname, "animation.html")
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/ethers")) return "vendor-ethers";
          if (id.includes("node_modules/react") || id.includes("node_modules/lucide-react")) {
            return "vendor-ui";
          }
          return undefined;
        }
      }
    }
  }
});
