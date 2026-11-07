"""Gemini via the official google-genai SDK."""

from google import genai
from google.genai import errors, types

from ...config import env
from .base import (
    ChatTurn,
    Conversation,
    Provider,
    ProviderError,
    Step,
    ToolCall,
    ToolResult,
    strip_keys,
)

_REFUSALS = {
    types.FinishReason.SAFETY,
    types.FinishReason.BLOCKLIST,
    types.FinishReason.PROHIBITED_CONTENT,
    types.FinishReason.SPII,
    types.FinishReason.RECITATION,
}


def _describe_error(error: errors.APIError, model: str) -> str:
    code = getattr(error, "code", None)
    message = getattr(error, "message", "") or ""
    if code in (401, 403) or "API_KEY_INVALID" in message or "API key not valid" in message:
        return "The GEMINI_API_KEY on the server is invalid or lacks access."
    if code == 404:
        return f'The Gemini model "{model}" was not found. Check GEMINI_MODEL.'
    if code == 429:
        return "Gemini is rate limited right now. Try again in a moment."
    if code == 400:
        return f"The request to Gemini was rejected: {message}"
    return f"The Gemini API returned an error ({code})."


class GeminiConversation(Conversation):
    def __init__(self, client: genai.Client, model, system, tools, history, user_message):
        self.client = client
        self.model = model
        self.config = types.GenerateContentConfig(
            system_instruction=system,
            tools=[
                types.Tool(
                    function_declarations=[
                        types.FunctionDeclaration(
                            name=t.name,
                            description=t.description,
                            # Gemini's JSON Schema support has no additionalProperties.
                            parameters_json_schema=strip_keys(t.parameters, {"additionalProperties"}),
                        )
                        for t in tools
                    ]
                )
            ],
            # We run the tools ourselves.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            max_output_tokens=8192,
        )
        self.contents: list[types.Content] = [
            types.Content(
                role="model" if turn.role == "assistant" else "user",
                parts=[types.Part(text=turn.content)],
            )
            for turn in history
        ]
        self.contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))
        self._unnumbered: set[str] = set()

    async def next_step(self) -> Step:
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model, contents=self.contents, config=self.config
            )
        except errors.APIError as error:
            raise ProviderError(_describe_error(error, self.model)) from error

        if not response.candidates:
            return Step(refused=True)
        candidate = response.candidates[0]
        if candidate.finish_reason in _REFUSALS:
            return Step(refused=True)

        parts = (candidate.content.parts if candidate.content else None) or []
        text = "\n".join(p.text for p in parts if p.text and not p.thought).strip()
        calls = []
        for i, part in enumerate(p for p in parts if p.function_call):
            call_id = part.function_call.id
            if not call_id:  # older models don't number their calls
                call_id = f"gemini-call-{len(self.contents)}-{i}"
                self._unnumbered.add(call_id)
            calls.append(
                ToolCall(id=call_id, name=part.function_call.name, arguments=part.function_call.args or {})
            )
        if calls:
            # Keep the model turn as-is: it carries the thought signatures Gemini
            # needs to continue a function-calling turn.
            self.contents.append(candidate.content)
        elif candidate.finish_reason == types.FinishReason.MALFORMED_FUNCTION_CALL:
            text = text or "I couldn't complete that change. Try rephrasing the request."
        return Step(
            text=text,
            tool_calls=calls,
            truncated=candidate.finish_reason == types.FinishReason.MAX_TOKENS,
        )

    def add_tool_results(self, results: list[ToolResult]) -> None:
        self.contents.append(
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        function_response=types.FunctionResponse(
                            id=None if r.call.id in self._unnumbered else r.call.id,
                            name=r.call.name,
                            response={"error": r.content} if r.is_error else {"result": r.content},
                        )
                    )
                    for r in results
                ],
            )
        )


class GeminiProvider(Provider):
    id = "gemini"
    label = "Gemini"
    api_key_env = "GEMINI_API_KEY"
    model_env = "GEMINI_MODEL"
    # Google's alias for the current Flash model.
    default_model = "gemini-flash-latest"

    def configured(self) -> bool:
        return bool(env(self.api_key_env) or env("GOOGLE_API_KEY"))

    def start(self, *, system, tools, history: list[ChatTurn], user_message) -> Conversation:
        base_url = env("GEMINI_BASE_URL")
        client = genai.Client(
            api_key=env(self.api_key_env) or env("GOOGLE_API_KEY"),
            http_options=types.HttpOptions(base_url=base_url) if base_url else None,
        )
        return GeminiConversation(client, self.model(), system, tools, history, user_message)
