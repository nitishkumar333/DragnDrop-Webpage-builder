"""The provider-neutral agent loop: ask the model, run its tool calls, repeat."""

import json
from typing import Any, AsyncIterator

from .operations import Element, find_element
from .page_session import PageSession
from .prompt import SYSTEM_PROMPT
from .providers import ChatTurn, Provider, ProviderError
from .providers.base import ToolResult
from .tools import TOOLS, execute_tool

MAX_TURNS = 12
MAX_OPERATIONS = 400


def build_user_message(
    session: PageSession, prompt: str, selected_id: str | None, device: str | None
) -> str:
    selected = find_element(session.elements, selected_id) if selected_id else None
    selection = (
        f"[{session.short_id(selected['id'])}] {selected.get('type')} "
        f"{json.dumps(selected.get('name') or '', ensure_ascii=False)}"
        if selected
        else "nothing"
    )
    return "\n".join(
        [
            "<page>",
            session.serialize(),
            "</page>",
            f"Selected element: {selection}",
            f"Device being previewed: {device or 'Desktop'}",
            "",
            "Request:",
            prompt,
        ]
    )


async def run_agent(
    provider: Provider,
    *,
    elements: list[Element],
    prompt: str,
    history: list[ChatTurn],
    selected_id: str | None,
    device: str | None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield stream events: `operations` while working, then `done` or `error`."""
    session = PageSession(elements)
    conversation = provider.start(
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        history=history,
        user_message=build_user_message(session, prompt, selected_id, device),
    )

    reply = ""
    try:
        for turn in range(MAX_TURNS):
            step = await conversation.next_step()
            if step.refused:
                yield {"type": "error", "message": "The AI declined this request. Try rephrasing it."}
                return

            if not step.tool_calls:
                reply = step.text
                if step.truncated:
                    reply = f"{reply}\n\n(The reply was cut off.)" if reply else "The reply was cut off."
                break

            results: list[ToolResult] = []
            for call in step.tool_calls:
                if call.parse_error:
                    results.append(ToolResult(call, call.parse_error, True))
                    continue
                if len(session.operations) >= MAX_OPERATIONS:
                    results.append(
                        ToolResult(call, "Change limit reached for this request. Stop and summarize.", True)
                    )
                    continue
                start = len(session.operations)
                outcome = execute_tool(session, call.name, call.arguments)
                results.append(ToolResult(call, outcome.result, outcome.is_error))
                if outcome.operation_count > 0:
                    event: dict[str, Any] = {
                        "type": "operations",
                        "operations": session.operations[start:],
                    }
                    if outcome.status:
                        event["status"] = outcome.status
                    yield event
            conversation.add_tool_results(results)

            if turn == MAX_TURNS - 1:
                reply = (
                    "I stopped after making several rounds of changes. "
                    "Ask me to continue if something is missing."
                )
    except ProviderError as error:
        yield {"type": "error", "message": str(error)}
        return

    yield {
        "type": "done",
        "message": reply or "Done.",
        "changeCount": len(session.operations),
        "provider": provider.id,
        "model": provider.model(),
    }
