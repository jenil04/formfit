import { defineAgentNativeConfig } from "@agent-native/core/config";

export default defineAgentNativeConfig({
  changelog: { enabled: false },
  harness: true,
  // Formfit drafts and chats with Claude only; hides other providers from the picker.
  agent: { builtInEngines: ["anthropic"], model: "claude-sonnet-5-5" },
});
