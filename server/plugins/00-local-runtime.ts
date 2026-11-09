import { defineNitroPlugin } from "@agent-native/core/server";

/**
 * Formfit is a single-box app: one persistent machine, one local PGlite
 * database on disk (data/pglite). The framework refuses local PGlite in a
 * production server bundle by default, because on serverless hosts the
 * filesystem is ephemeral. Its supported exemption is the "embedded runtime"
 * flag that packaged/self-hosted installs set (see core db/embedded-runtime).
 * We set it here, first (the 00- prefix orders it before db.ts), because this
 * deployment's disk is persistent by construction. Do not copy this to a
 * serverless deploy; set DATABASE_URL to hosted Postgres there instead.
 */
export default defineNitroPlugin(() => {
  (
    globalThis as { __AGENT_NATIVE_EMBEDDED_RUNTIME__?: boolean }
  ).__AGENT_NATIVE_EMBEDDED_RUNTIME__ = true;
});
