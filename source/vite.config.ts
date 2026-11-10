import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const root = path.dirname(fileURLToPath(import.meta.url));
const native = process.env.VITE_NATIVE === "1";
const pushReady =
  fs.existsSync(path.join(root, "android/app/google-services.json")) ||
  fs.existsSync(path.join(root, "ios/App/App/GoogleService-Info.plist"));

export default defineConfig({
  base: native ? "./" : "/SparkAppDemo/",
  define: {
    "import.meta.env.VITE_PUSH_ENABLED": JSON.stringify(pushReady ? "1" : "0"),
  },
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true, routesDirectory: "./src/routes" }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
