"""Provider-neutral interface for the agent loop.

Each provider keeps the conversation in its own native message format; the
agent only sees `Step`s (text plus tool calls) and hands back tool results.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from ..tools import ToolDefinition
from ...config import env


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Any
    # Set when the provider returned arguments that are not valid JSON.
    parse_error: str | None = None


@dataclass
class Step:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    refused: bool = False
    truncated: bool = False


@dataclass
class ToolResult:
    call: ToolCall
    content: str
    is_error: bool


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str


class ProviderError(Exception):
    """A provider failure with a message that is safe to show to the user."""


class Conversation(ABC):
    @abstractmethod
    async def next_step(self) -> Step: ...

    @abstractmethod
    def add_tool_results(self, results: list[ToolResult]) -> None: ...


class Provider(ABC):
    id: str
    label: str
    api_key_env: str
    model_env: str
    default_model: str

    def configured(self) -> bool:
        return bool(env(self.api_key_env))

    def model(self) -> str:
        return env(self.model_env, self.default_model)

    @abstractmethod
    def start(
        self,
        *,
        system: str,
        tools: list[ToolDefinition],
        history: list[ChatTurn],
        user_message: str,
    ) -> Conversation: ...


def strip_keys(schema: Any, keys: set[str]) -> Any:
    """Recursively remove JSON Schema keywords a provider does not accept."""
    if isinstance(schema, dict):
        return {k: strip_keys(v, keys) for k, v in schema.items() if k not in keys}
    if isinstance(schema, list):
        return [strip_keys(v, keys) for v in schema]
    return schema
