// Runs the backend's virtualenv Python inside backend/, e.g.
//   node scripts/backend-python.mjs -m pytest -q
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const backendDir = path.join(root, "backend");

export function venvPython() {
  const candidates = [
    path.join(backendDir, ".venv", "Scripts", "python.exe"),
    path.join(backendDir, ".venv", "bin", "python"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

export function runPython(args, options = {}) {
  const python = venvPython();
  if (!python) {
    console.error(
      "The Python backend is not set up yet. Run `npm run setup:backend` (needs Python 3.10+)."
    );
    return null;
  }
  return spawn(python, args, { cwd: backendDir, stdio: "inherit", ...options });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const child = runPython(process.argv.slice(2));
  if (!child) process.exit(1);
  child.on("exit", (code) => process.exit(code ?? 1));
}
