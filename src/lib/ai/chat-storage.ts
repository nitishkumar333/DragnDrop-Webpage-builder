/** Each page's AI conversation is kept in this browser's localStorage. */
export const chatStorageKey = (pageId: string) => `ai-chat:${pageId}`;

export const forgetChat = (pageId: string) => {
  try {
    localStorage.removeItem(chatStorageKey(pageId));
  } catch {
    // Storage is blocked, so there is nothing to remove.
  }
};
