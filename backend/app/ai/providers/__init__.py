"""Registry of AI providers."""

from ...config import env
from .anthropic_provider import AnthropicProvider
from .base import ChatTurn, Provider, ProviderError

PROVIDERS: dict[str, Provider] = {
    p.id: p for p in (AnthropicProvider(),)
}


def default_provider_id() -> str | None:
    """AI_PROVIDER if it is configured, otherwise the first configured provider."""
    preferred = env("AI_PROVIDER").lower()
    if preferred in PROVIDERS and PROVIDERS[preferred].configured():
        return preferred
    return next((p.id for p in PROVIDERS.values() if p.configured()), None)


__all__ = ["PROVIDERS", "ChatTurn", "Provider", "ProviderError", "default_provider_id"]
