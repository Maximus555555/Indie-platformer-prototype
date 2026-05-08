const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "8000", 10);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);

function resolveRequestPath(url) {
  const { pathname } = new URL(url, `http://${host}:${port}`);
  let normalizedPathname;

  try {
    normalizedPathname = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
  const requestedPath = normalizedPathname === "" ? "index.html" : normalizedPathname;
  const filePath = path.resolve(repoRoot, requestedPath);

  if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const contentType = contentTypes.get(path.extname(filePath)) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Indie Platformer Prototype running at http://${host}:${port}`);
});
