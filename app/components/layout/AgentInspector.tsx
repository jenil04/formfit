import { navigateWithAgentChatViewTransition } from "@agent-native/core/client/agent-chat";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { ChatComposerContextProvider } from "@/components/ChatComposerContext";
import { chatThreadPath } from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Contextual inspector shell used on secondary chat routes. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function openAskAgentFullscreen(threadId?: string) {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
  }

  const isFitPath =
    pathname.startsWith("/fit") || pathname.startsWith("/programs");

  return (
    <AgentSidebar
      composerContextProvider={ChatComposerContextProvider}
      position="right"
      defaultOpen={isFitPath}
      defaultSidebarWidth={380}
      dynamicSuggestions={false}
      showModelSelector={!isFitPath}
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText="Ask me to fill, shorten or explain any field. I know which form and field you have open."
      agentPageHref="/settings/agent"
      suggestions={[
        "Fill everything that's safe",
        "Make this one punchier",
        "Fit this to 280 characters",
        "Why is #7 amber?",
      ]}
    >
      {children}
    </AgentSidebar>
  );
}
