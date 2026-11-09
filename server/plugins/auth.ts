import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

/**
 * Public demo: every visitor lands straight in one shared demo workspace, no
 * sign-up. AUTH_DISABLED is (rightly) refused in production, so we use the
 * framework's documented custom-auth hook instead: `getSession` resolves every
 * request to the same guest identity. Auth stays enabled, so the production
 * config checks (BETTER_AUTH_SECRET etc.) still apply.
 *
 * Trade-off, stated plainly: the workspace is shared and unauthenticated, so
 * anyone with the URL can read and edit it. That is the point of the demo;
 * "Reset demo" restores it. The agent surface is locked down in
 * agent-chat.ts and LLM spend is capped in middleware/llm-guard.ts.
 */
const DEMO_SESSION = {
  email: "demo@formfit.app",
  userId: "formfit-demo",
  name: "Demo founder",
  emailVerified: true,
};

const guest = async () => ({ ...DEMO_SESSION });

export default createToolkitAuthPlugin({
  getSession: guest,
  getBrowserSession: guest,
  workspaceAppPublicPaths: ["/"],
  rootAuth: true,
  marketing: false,
});
