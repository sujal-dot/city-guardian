// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_URL || "http://localhost:4000";

  return {
    server: {
      host: "localhost",
      port: 8081,
      strictPort: false,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (routePath) => routePath.replace(/^\/api/, ""),
        },
      },
    },
    plugins: [
      react() // ✅ ONLY THIS
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
