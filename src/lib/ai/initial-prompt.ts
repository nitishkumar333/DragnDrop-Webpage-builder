/**
 * Hands a page description from the "new page" dialog to the editor's AI chat.
 * Taking it removes it, so reloading the editor never runs the request again.
 */
const key = (pageId: string) => `ai-initial-prompt:${pageId}`;

export const setInitialAiPrompt = (pageId: string, prompt: string) => {
  try {
    sessionStorage.setItem(key(pageId), prompt);
  } catch {
    // Storage is blocked: the page opens empty and the user can ask in the chat.
  }
};

export const takeInitialAiPrompt = (pageId: string): string | null => {
  try {
    const prompt = sessionStorage.getItem(key(pageId));
    if (prompt) sessionStorage.removeItem(key(pageId));
    return prompt;
  } catch {
    return null;
  }
};
