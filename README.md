# Formfit

**Your answer bank, fitted to every form. The agent drafts, you edit, it learns.**

Formfit keeps a founder's best answers in one place, then drafts every field of any application form from that bank, fitted to the exact character limit, without inventing a single number. Fields only a human can answer (wallet address, phone, KYC, legal terms) are never auto-filled; they turn amber with the reason.

Built for the Builder.io Agent-Native Hackathon on the [Agent-Native](https://github.com/BuilderIO/agent-native) framework.

## The problem

If you build in public you fill out dozens of grant, accelerator, hackathon and startup-program forms. They all ask the same twenty questions with different limits: *one-liner in 140 characters, problem in 500, traction in 300, team in 400, why now in 300.*

Today that means a Google Doc, copy-paste, and rewriting each answer to fit. It goes wrong in predictable ways:

- A "300 characters" answer is 340, and you find out on submit.
- Numbers drift. The pilot count from last month, or a rounded-up figure that was never true, ends up in an application.
- You get stuck on fields only you can answer (payout wallet, phone, tax ID, "I agree"), and you lose the thread of what is still open.
- Each edit you make teaches you something that never makes it back into the doc.

## Who it's for

Founders and indie builders who apply to many programs: accelerators, grants, hackathons, startup credits. Small teams that cannot justify an enterprise proposal-management tool but are tired of the Google Doc.

## Why now

- Models are finally good enough to *fit* text to a length without losing the point, and cheap enough to do it per field.
- Agent-native frameworks make "the agent and the UI share one set of actions" the default, which is what makes a drafting tool trustworthy: the agent cannot do anything the UI cannot, and both go through the same guardrails.
- The failure mode that matters is not bad prose, it is a confident invented number. That is checkable in code, so Formfit checks it in code.

## How it compares

| | Formfit | Loopio / Responsive | Grantable | ChatGPT + copy-paste |
|---|---|---|---|---|
| Built for | Founders filling many small forms | Enterprise sales teams answering RFPs and security questionnaires | Grant writers and nonprofits | Anyone |
| Answer library | Yes: topics, canonical answers, hard facts with sources | Yes, with review workflows and permissions | Yes, a writing workspace | No memory unless you paste it every time |
| Exact limit fitting | Counted server-side, never exceeds | Not the focus | Not the focus | You count |
| Won't invent numbers | Deterministic check: any figure not in the bank is rejected | Human review process | Human review | No |
| Knows what only *you* can answer | Classifier flags wallet, phone, KYC, tax, legal, equity | Not the focus | Not the focus | No |
| Learns from your edits | Proposes a bank diff you accept | Library maintenance by admins | Manual | No |
| Agent shares the UI's actions | Yes | n/a | n/a | n/a |
| Scale | One founder, one bank | Teams and seats | Teams | One chat |

Loopio, Responsive and Grantable are established products and this is a hackathon project; the table describes the *shape* of each, not a feature audit.

## 2-minute demo path

1. **Open the app.** It lands straight in a shared demo workspace, no sign-up. Three panes: answer bank (left), form (center), agent (right).
2. **Click "Load sample founder + form".** The fictional startup *Tidewell* gets a bank of 11 entries and the *Lumen Accelerator* form is imported: 16 fields, limits parsed, **4 already amber** (phone, funding terms, date of birth, terms checkbox).
3. **Click "Fill 12 safe fields".** Fields drafted from the bank land one by one, each with a live character meter (green, amber near the limit, red over) and **provenance chips** naming the bank entries and facts used. Click a field and the bank pane lights up the entries it used.
4. **Look at #7, "monthly recurring revenue".** It is amber: *"No revenue figure in your bank."* The agent did not invent one.
5. **Edit the traction answer.** Add a fact the bank doesn't have ("two pilots renewed after their first month") and click away. A small diff appears: *Learn from your edit*. Click **Add to bank** and the traction entry updates, visibly.
6. **Paste your own form.** *New form*, paste messy text (labels, "(max 500 characters)", "Required", dropdown options). The preview shows what the parser found, live.
7. **Ask the agent.** With a field selected: *"make this one punchier"*, *"fit this to 280"*, *"why is #7 amber?"*, *"fill everything that's safe"*. It knows which form and field you have open.
8. **Copy packet.** Per-field Copy buttons, a status per field, and a whole-form copy. Mark the form Draft / Ready / Submitted. **Reset demo** (bottom of the bank pane) restores the starting state.

## How it uses Agent-Native

Everything the app does is a `defineAction` in [`actions/`](actions). The UI calls them with `useActionQuery` / `useActionMutation`, the agent calls them as tools, and each is also an HTTP endpoint at `/_agent-native/actions/<name>`. There is no second code path for the agent.

| Action | What it does | UI | Agent | HTTP/CLI |
|---|---|---|---|---|
| `list-bank` | The answer bank | bank pane | yes | yes |
| `upsert-bank-entry` | Create / edit an entry and its facts | bank editor | yes | yes |
| `delete-bank-entry` | Remove an entry | bank editor | yes | yes |
| `import-form` | Pasted text to structured fields (deterministic parser) | New form dialog | yes | yes |
| `list-forms` / `get-form` | Forms, fields, proposals | switcher, workspace | yes | yes |
| `delete-form` | Remove a form | switcher | yes | yes |
| `fill-field` | Draft one field, fitted; `instruction` and `targetChars` for "punchier" / "fit to 280" | Draft / Redraft | yes | yes |
| `fill-form` | Draft every safe field | "Fill N safe fields" | yes | yes |
| `update-field` | Manual edit, ready toggle, fix parsed structure | inline editor | yes (fixes bad imports) | yes |
| `classify-field` | Is this a human-only field, and why | amber reasons | yes ("why is #7 amber?") | yes |
| `learn-from-edit` | Propose a bank update from an edit | auto after an edit | yes | yes |
| `apply-bank-update` | Accept or dismiss that proposal | "Add to bank" | yes | yes |
| `export-packet` | Copy-paste packet with counts and status | Copy packet | yes | yes |
| `set-form-status` | draft / ready / submitted (refuses ready while required fields are open) | status control | yes | yes |
| `load-sample` / `reset-demo` | First-run sample and demo reset | empty state, Reset demo | yes | yes |
| `view-screen` | What the user is looking at | n/a | yes | agent only |

**Context awareness.** The route is `/fit/:formId?field=:fieldId`. `use-navigation-state` publishes `formId` and `fieldId` to application state on every navigation. `view-screen` reads it and returns the open form, the *selected field* in full, pending proposals and a bank summary. That is how "make this one punchier" and "why is #7 amber?" resolve without the user pasting anything. The agent can also move the UI with `navigate` (`/fit/<id>?field=<id>`).

**Shared state.** Data lives in SQL (`ff_bank_entries`, `ff_forms`, `ff_fields`, `ff_bank_proposals`). Agent writes show up in the UI through the framework's change sync, and UI edits are visible to the agent on its next `view-screen`.

**Agent skill and system prompt.** [`server/plugins/agent-chat.ts`](server/plugins/agent-chat.ts) carries the guardrails and intent-to-action mapping; [`.agents/skills/formfit-guardrails`](.agents/skills/formfit-guardrails/SKILL.md) is the same in skill form. The in-app agent and drafting both use `claude-sonnet-5-5`.

## Guardrails

Rules are enforced in code, not only in prompts.

1. **Grounded numbers.** [`shared/grounding.ts`](shared/grounding.ts) extracts every figure from a draft (handling `$`, commas, `k/m/b`, `%`) and rejects the draft if any is absent from the bank. The model gets one retry with feedback; after that the field is "needs you" with the offending figures named.
2. **Sensitive fields never reach the model.** [`shared/classifier.ts`](shared/classifier.ts) flags wallet/payout address, phone, government ID/KYC/passport, tax ID (EIN/PAN), home/street address, date of birth, bank/card, legal terms/consent/signature/"I agree" (and every checkbox), equity/investment terms and references' contact info. They are classified at import, shown amber with a reason, skipped by `fill-form`, and never learned into the bank.
3. **Never exceeds a limit.** [`shared/fit.ts`](shared/fit.ts) counts characters and words server-side, asks the model to aim for ~92% of the limit, re-fits up to twice, then hard-trims at a sentence or word boundary. The result is guaranteed to fit.
4. **Provenance.** Drafts must cite bank entries and facts; citations are validated against real ids. A draft that cites nothing is rejected.
5. **Exact-value kinds.** Select answers must be one of the options; URL and email answers must appear in the bank.
6. **Demo cost caps.** 60 LLM-backed requests per hour per IP and a global cap of 400 per day (`server/middleware/llm-guard.ts`), returning a friendly 429 message; plus a hard daily ceiling on raw model calls. In memory, reset on restart.
7. **Locked-down agent surface** for the shared demo: raw SQL tools, extensions, connectors and code execution are off; the app's actions are the only data path.

## Architecture

```
app/components/fit/   Workspace (3 panes), BankPane, FieldCard, ProposalCard (diff), dialogs
app/routes/fit.($formId).tsx
actions/              16 defineAction files, shared by UI / agent / HTTP
shared/               pure TS, unit tested, imported by server AND client:
                      parser.ts  classifier.ts  fit.ts  grounding.ts  seed.ts  samples.ts
server/lib/formfit/   store (SQL), fill (drafting + guardrails), learn (proposals), llm, rate-limit
server/db/schema.ts   Drizzle tables; server/plugins/db.ts migrations
server/middleware/llm-guard.ts   per-IP / global LLM request caps
server/plugins/       agent-chat (model, prompt, tool surface), auth (guest), local-runtime
```

The parser runs in the browser too, so the *New form* dialog previews exactly what the server will import.

## Run locally

```bash
export COREPACK_HOME=$HOME/.cache/corepack
pnpm install
export ANTHROPIC_API_KEY=...     # drafting and the in-app agent
pnpm dev                          # prints the local URL; dev signs you in automatically
pnpm test                         # parser, classifier, fitting, grounding, rate limit
pnpm typecheck
```

Production (what the demo runs):

```bash
scripts/serve.sh   # builds if needed, serves on PORT=4310; sources secrets from a file at runtime
```

`serve.sh` generates a session secret into `data/.auth-secret` on first run (untracked) and reads `ANTHROPIC_API_KEY` from `/workspace/secrets/cto-anthropic.env` (override with `FORMFIT_ENV_FILE`). The database is local PGlite at `data/pglite`.

Two deliberate production choices, both documented in code:

- **Guest auth.** `AUTH_DISABLED` is refused in production by the framework. `server/plugins/auth.ts` uses the documented custom `getSession` hook to resolve every request to one shared guest, with auth otherwise left on. The workspace is therefore shared and unauthenticated: anyone with the URL can read and edit it. That is the demo's point; *Reset demo* restores it. Do not put private data in it.
- **Local PGlite in production.** The framework refuses local PGlite in a production server bundle because serverless filesystems are ephemeral. `server/plugins/00-local-runtime.ts` sets the framework's embedded-runtime flag, which is correct only for a persistent single box like this one. On a serverless host, set `DATABASE_URL` to hosted Postgres and delete that plugin.

## Built during the hackathon

Scaffolded on Nov 9, 2026 from `@agent-native/core create --template chat`. The framework and the chat template are pre-existing and MIT-licensed. All Formfit actions, schema, UI, parser, classifier and prompts were written Nov 9-10, 2026.

The demo founder and startup ("Tidewell", Asha Rivera, Leo Tanaka) and both sample forms (Lumen Accelerator, Northwind Open Builders Grant) are invented. The figures in the seeded bank belong to that fictional company; nothing here describes real users or traction for Formfit.

## Known gaps

- The parser is heuristic. It handles the pasted-text shapes in the tests and the two samples, and the agent can repair mistakes with `update-field`, but an unusual layout can still merge or split a field.
- Single shared workspace; no per-user banks or sharing.
- Rate limits are in memory and per process.
- No file/PDF import and no browser extension to fill the live page; the output is a copy-paste packet.
- Grounding checks figures, not names or qualitative claims; those rely on the prompt and on provenance.

## License

MIT, see [LICENSE](LICENSE).
