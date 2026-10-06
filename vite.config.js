import { defineConfig } from "vite";
import { cp, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const cmapSource = resolve("node_modules/pdfjs-dist/cmaps");

function pdfCmaps() {
  return {
    name: "pdfjs-cmaps",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url, "http://localhost").pathname;
        if (!pathname.startsWith("/cmaps/")) return next();
        const filename = basename(pathname);
        if (!filename.endsWith(".bcmap")) return next();
        try {
          response.setHeader("Content-Type", "application/octet-stream");
          response.end(await readFile(resolve(cmapSource, filename)));
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      await cp(cmapSource, resolve("dist/cmaps"), { recursive: true });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [pdfCmaps()],
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
