"""Providers with an OpenAI-compatible Chat Completions API: DeepSeek and Groq."""

import json
from typing import Any

import openai

from ...config import env
from .base import ChatTurn, Conversation, Provider, ProviderError, Step, ToolCall, ToolResult


def _describe_error(error: Exception, label: str, key_env: str, model_env: str, model: str) -> str:
    if isinstance(error, openai.AuthenticationError):
        return f"The {key_env} on the server is invalid."
    if isinstance(error, openai.PermissionDeniedError):
        return f'This {label} API key cannot use the model "{model}".'
    if isinstance(error, openai.NotFoundError):
        return f'The {label} model "{model}" was not found. Check {model_env}.'
    if isinstance(error, openai.RateLimitError):
        return f"{label} is rate limited right now. Try again in a moment."
    if isinstance(error, openai.BadRequestError):
        return f"The request to {label} was rejected: {error.message}"
    if isinstance(error, openai.APIConnectionError):
        return f"Could not reach the {label} API."
    if isinstance(error, openai.APIStatusError):
        return f"The {label} API returned an error ({error.status_code})."
    return f"Something went wrong while talking to {label}."


class OpenAICompatibleConversation(Conversation):
    def __init__(self, provider: "OpenAICompatibleProvider", system, tools, history, user_message):
        self.provider = provider
        self.model = provider.model()
        self.client = openai.AsyncOpenAI(api_key=env(provider.api_key_env), base_url=provider.base_url())
        self.tools = [
            {
                "type": "function",
                "function": {"name": t.name, "description": t.description, "parameters": t.parameters},
            }
            for t in tools
        ]
        self.messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
        self.messages += [{"role": turn.role, "content": turn.content} for turn in history]
        self.messages.append({"role": "user", "content": user_message})

    async def next_step(self) -> Step:
        p = self.provider
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=self.messages,
                tools=self.tools,
                tool_choice="auto",
                max_tokens=8192,
            )
        except openai.APIError as error:
            raise ProviderError(
                _describe_error(error, p.label, p.api_key_env, p.model_env, self.model)
            ) from error

        if not response.choices:
            return Step(refused=True)
        choice = response.choices[0]
        message = choice.message
        if choice.finish_reason == "content_filter":
            return Step(refused=True)

        calls: list[ToolCall] = []
        for tc in message.tool_calls or []:
            raw = tc.function.arguments or "{}"
            try:
                calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=json.loads(raw)))
            except json.JSONDecodeError:
                calls.append(
                    ToolCall(id=tc.id, name=tc.function.name, arguments=None,
                             parse_error="The tool arguments were not valid JSON. Send valid JSON.")
                )

        if calls:
            assistant: dict[str, Any] = {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
                    }
                    for tc in message.tool_calls or []
                ],
            }
            # DeepSeek's thinking mode requires its reasoning to be sent back while
            # the same turn is still calling tools.
            reasoning = (message.model_extra or {}).get("reasoning_content")
            if p.echo_reasoning and reasoning:
                assistant["reasoning_content"] = reasoning
            self.messages.append(assistant)

        return Step(
            text=(message.content or "").strip(),
            tool_calls=calls,
            truncated=choice.finish_reason == "length",
        )

    def add_tool_results(self, results: list[ToolResult]) -> None:
        for r in results:
            self.messages.append(
                {
                    "role": "tool",
                    "tool_call_id": r.call.id,
                    "content": f"Error: {r.content}" if r.is_error else r.content,
                }
            )


class OpenAICompatibleProvider(Provider):
    base_url_env: str
    default_base_url: str
    echo_reasoning = False

    def base_url(self) -> str:
        return env(self.base_url_env, self.default_base_url)

    def start(self, *, system, tools, history: list[ChatTurn], user_message) -> Conversation:
        return OpenAICompatibleConversation(self, system, tools, history, user_message)


class DeepSeekProvider(OpenAICompatibleProvider):
    id = "deepseek"
    label = "DeepSeek"
    api_key_env = "DEEPSEEK_API_KEY"
    model_env = "DEEPSEEK_MODEL"
    default_model = "deepseek-v4-flash"
    base_url_env = "DEEPSEEK_BASE_URL"
    default_base_url = "https://api.deepseek.com"
    echo_reasoning = True


class GroqProvider(OpenAICompatibleProvider):
    id = "groq"
    label = "Groq"
    api_key_env = "GROQ_API_KEY"
    model_env = "GROQ_MODEL"
    default_model = "openai/gpt-oss-120b"
    base_url_env = "GROQ_BASE_URL"
    default_base_url = "https://api.groq.com/openai/v1"
