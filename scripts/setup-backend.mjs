// `npm run setup:backend`: creates backend/.venv and installs the Python dependencies.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { backendDir, venvPython } from "./backend-python.mjs";

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: backendDir, stdio: "inherit" });
  return result.status === 0;
};

if (!venvPython()) {
  const created = ["python3", "python", "py"].some((python) =>
    run(python, ["-m", "venv", path.join(backendDir, ".venv")])
  );
  if (!created || !venvPython()) {
    console.error("Could not create a virtualenv. Install Python 3.10+ and try again.");
    process.exit(1);
  }
}

const python = venvPython();
const ok =
  run(python, ["-m", "pip", "install", "--upgrade", "pip"]) &&
  run(python, ["-m", "pip", "install", "-r", "requirements-dev.txt"]);
process.exit(ok ? 0 : 1);
