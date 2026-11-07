"""Claude via the official Anthropic SDK."""

import re
from typing import Any

import anthropic

from ...config import env
from .base import ChatTurn, Conversation, Provider, ProviderError, Step, ToolCall, ToolResult

# Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
# Models that accept output_config.effort.
_EFFORT_MODELS = re.compile(r"^claude-(fable|mythos|opus|sonnet|haiku)-(5|4-[5-9])")


def _describe_error(error: Exception, model: str) -> str:
    if isinstance(error, anthropic.AuthenticationError):
        return "The ANTHROPIC_API_KEY on the server is invalid."
    if isinstance(error, anthropic.PermissionDeniedError):
        return f'This API key cannot use the model "{model}".'
    if isinstance(error, anthropic.NotFoundError):
        return f'The model "{model}" was not found. Check ANTHROPIC_MODEL.'
    if isinstance(error, anthropic.RateLimitError):
        return "Claude is rate limited right now. Try again in a moment."
    if isinstance(error, anthropic.BadRequestError):
        return f"The request to Claude was rejected: {error.message}"
    if isinstance(error, anthropic.APIConnectionError):
        return "Could not reach the Claude API."
    if isinstance(error, anthropic.APIStatusError):
        return f"The Claude API returned an error ({error.status_code})."
    return "Something went wrong while talking to Claude."


class AnthropicConversation(Conversation):
    def __init__(self, client, model, system, tools, history, user_message):
        self.client = client
        self.model = model
        self.system = system
        self.tools = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
                "strict": True,
            }
            for t in tools
        ]
        self.messages: list[dict[str, Any]] = [
            {"role": turn.role, "content": turn.content} for turn in history
        ]
        self.messages.append({"role": "user", "content": user_message})

    async def next_step(self) -> Step:
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 16000,
            "system": self.system,
            "tools": self.tools,
            "messages": self.messages,
            "cache_control": {"type": "ephemeral"},
        }
        if _EFFORT_MODELS.match(self.model):
            params["output_config"] = {"effort": env("ANTHROPIC_EFFORT", env("AI_EFFORT", "medium"))}
        if self.model in FALLBACK_MODELS:
            params["betas"] = ["server-side-fallback-2026-07-01"]
            params["fallbacks"] = "default"
        try:
            response = await self.client.beta.messages.create(**params)
        except anthropic.APIError as error:
            raise ProviderError(_describe_error(error, self.model)) from error

        if response.stop_reason == "refusal":
            return Step(refused=True)
        text = "\n".join(b.text for b in response.content if b.type == "text").strip()
        calls = [
            ToolCall(id=b.id, name=b.name, arguments=b.input)
            for b in response.content
            if b.type == "tool_use"
        ]
        if calls:
            self.messages.append({"role": "assistant", "content": response.content})
        return Step(text=text, tool_calls=calls, truncated=response.stop_reason == "max_tokens")

    def add_tool_results(self, results: list[ToolResult]) -> None:
        self.messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": r.call.id,
                        "content": r.content,
                        **({"is_error": True} if r.is_error else {}),
                    }
                    for r in results
                ],
            }
        )


class AnthropicProvider(Provider):
    id = "anthropic"
    label = "Claude"
    api_key_env = "ANTHROPIC_API_KEY"
    model_env = "ANTHROPIC_MODEL"
    default_model = "claude-opus-5-5"

    def model(self) -> str:
        # AI_MODEL was the setting before multiple providers existed.
        return env(self.model_env, env("AI_MODEL", self.default_model))

    def start(self, *, system, tools, history: list[ChatTurn], user_message) -> Conversation:
        # Reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL, if set) from the environment.
        client = anthropic.AsyncAnthropic(api_key=env(self.api_key_env))
        return AnthropicConversation(client, self.model(), system, tools, history, user_message)
