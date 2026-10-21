// Local test server for a project Pages URL. Not a production server.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArtifacts, checkRelease } from "./check-artifacts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const prefix = "/careflow-dashboard/";
await checkRelease(root);
const allowed = new Set(await checkArtifacts(dist, "dist"));
const mime = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  json: "application/json; charset=utf-8",
};
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const url = new URL(request.url, "http://127.0.0.1:4173");
    const path = decodeURIComponent(url.pathname);
    if (path === prefix.slice(0, -1)) {
      response.writeHead(308, { Location: prefix + url.search }).end();
      return;
    }
    const relative =
      path === prefix
        ? "index.html"
        : path.startsWith(prefix)
          ? path.slice(prefix.length)
          : "";
    if (!allowed.has(relative)) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(join(dist, relative));
    response.writeHead(200, {
      "Content-Type": mime[relative.split(".").at(-1)],
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(400).end();
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log(`Pages path test server: ${prefix}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
