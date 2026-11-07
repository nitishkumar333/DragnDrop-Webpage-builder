// `npm run dev`: starts the FastAPI backend and the Next.js dev server together.
// Extra arguments go to `next dev`, e.g. `npm run dev -- -p 3001`.
import { spawn } from "node:child_process";
import path from "node:path";
import { root, runPython } from "./backend-python.mjs";

const backendUrl = new URL(process.env.BACKEND_URL || "http://localhost:8000");
const port = backendUrl.port || "8000";
const children = [];

const api = runPython(
  ["-m", "uvicorn", "app.main:app", "--reload", "--reload-dir", "app", "--port", port],
  { env: process.env }
);
if (api) children.push(api);
else console.warn("Starting the website only; API calls will fail until the backend runs.\n");

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const web = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});
children.push(web);

const stop = () => children.forEach((c) => !c.killed && c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("exit", (code) => {
    stop();
    process.exit(code ?? 0);
  });
}
