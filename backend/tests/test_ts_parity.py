"""The editor replays the backend's operations with its TypeScript applyOperations.
This test checks both implementations produce the same page."""

import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

from app.ai.page_session import PageSession
from app.ai.tools import BLOCK_KINDS, execute_tool

from .conftest import body_with

REPO = Path(__file__).resolve().parents[2]

NODE_SCRIPT = r"""
const fs = require("fs"), path = require("path"), ts = require("typescript");
const repo = process.argv[1], out = path.join(repo, "node_modules", ".cache", "ops-parity");
fs.mkdirSync(out, { recursive: true });
for (const [src, dest] of [["src/lib/editor-tree.ts", "editor-tree.js"], ["src/lib/ai/operations.ts", "operations.js"]]) {
  let code = fs.readFileSync(path.join(repo, src), "utf8").replace('"@/lib/editor-tree"', '"./editor-tree"');
  code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  fs.writeFileSync(path.join(out, dest), code);
}
const { applyOperations } = require(path.join(out, "operations.js"));
const input = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify(applyOperations(input.elements, input.operations)));
"""


def random_session(seed: int) -> tuple[list, PageSession]:
    rng = random.Random(seed)
    initial = body_with()
    session = PageSession(json.loads(json.dumps(initial)))
    for _ in range(25):
        ids = [s for s in session._to_real]  # every short id known so far
        tool = rng.choice(["add_block", "add_element", "update_styles", "update_content", "delete_elements", "move_element", "duplicate_element"])
        pick = lambda: rng.choice(ids)  # noqa: E731
        args = {
            "add_block": lambda: {"kind": rng.choice(list(BLOCK_KINDS)), **({"after_id": pick()} if rng.random() < 0.5 else {})},
            "add_element": lambda: {"type": rng.choice(["text", "heading", "button", "spacer", "container"]), "parent_id": pick(), "styles": [{"property": "color", "value": "#123456"}], **({"after_id": "top"} if rng.random() < 0.3 else {})},
            "update_styles": lambda: {"ids": [pick(), pick()], "styles": [{"property": "fontSize", "value": str(rng.randint(10, 60))}, {"property": "marginTop", "value": ""}]},
            "update_content": lambda: {"id": pick(), "fields": [{"field": "text", "value": f"text {rng.random():.3f}"}]},
            "delete_elements": lambda: {"ids": [pick()]},
            "move_element": lambda: {"id": pick(), "parent_id": pick(), **({"after_id": "top"} if rng.random() < 0.3 else {})},
            "duplicate_element": lambda: {"id": pick()},
        }[tool]()
        execute_tool(session, tool, args)
    return initial, session


@pytest.mark.skipif(
    shutil.which("node") is None or not (REPO / "node_modules" / "typescript").exists(),
    reason="needs node and the frontend's node_modules",
)
@pytest.mark.parametrize("seed", range(8))
def test_typescript_apply_operations_matches(seed):
    initial, session = random_session(seed)
    assert session.operations, "the random script should change something"
    result = subprocess.run(
        ["node", "-e", NODE_SCRIPT, str(REPO)],
        input=json.dumps({"elements": initial, "operations": session.operations}),
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    assert json.loads(result.stdout) == session.elements
