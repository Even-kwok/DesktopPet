import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: "src/main/app.ts"
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: "src/preload/index.ts"
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          studio: "index.html",
          pet: "pet.html"
        }
      }
    }
  }
});
