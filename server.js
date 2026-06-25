// Servidor estático mínimo, sin dependencias.
// Sirve los archivos de la carpeta /public en http://localhost:3000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    // Evita salir de la carpeta public (path traversal)
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Prohibido");
      return;
    }
    const data = await readFile(filePath);
    const type = TYPES[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
});

// Arranca en el puerto indicado y, si está ocupado, prueba automáticamente
// los siguientes (hasta 20 puertos más arriba) hasta encontrar uno libre.
let puertoActual = Number(PORT);
const PUERTO_MAX = Number(PORT) + 20;

server.on("listening", () => {
  console.log(`\n  Coste de Menús ejecutándose en  http://localhost:${puertoActual}\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    if (puertoActual < PUERTO_MAX) {
      console.log(`  Puerto ${puertoActual} ocupado, probando ${puertoActual + 1}…`);
      puertoActual += 1;
      setTimeout(() => server.listen(puertoActual), 100);
    } else {
      console.error("\n  No se encontró un puerto libre. Prueba otro: PORT=8080 npm start\n");
      process.exit(1);
    }
  } else {
    throw err;
  }
});

server.listen(puertoActual);
