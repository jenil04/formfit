---
name: formfit-guardrails
description: Rules for drafting application-form answers from the answer bank. Use whenever filling, refitting, importing or explaining Formfit fields, or proposing bank updates.
---

# Formfit guardrails

Formfit fits a founder's **answer bank** to application forms. The agent drafts, the founder edits, the bank learns. Every surface (UI, agent chat, HTTP, CLI) calls the same actions in `actions/`.

## Where truth lives

- Facts come only from the bank (`list-bank`): topic, canonical answer, hard facts with a source note.
- Never invent or round numbers, dates, names, URLs or claims. The server also enforces this: `shared/grounding.ts` rejects a draft containing any figure not in the bank and the field becomes "needs you".
- If the bank lacks the answer, leave the field **needs you** with a reason ("No revenue figure in your bank"), or ask the founder for the fact and `upsert-bank-entry` it.

## Sensitive fields: never auto-fill

`shared/classifier.ts` (deterministic, unit tested) flags: wallet/payout address, phone, government ID/KYC/passport, tax ID (EIN/PAN), home/street address, date of birth, bank/card, legal terms/consent/signature/"I agree" (and every checkbox), equity/investment terms, references' contact info. These never reach the model, stay amber, and are never learned into the bank.

## Limits

`fill-field` / `fill-form` count characters server-side, aim at ~92% of the limit, re-fit with the model up to twice, then hard-trim at a sentence/word boundary. Output never exceeds the limit. "Fit this to 280" = `fill-field` with `targetChars: 280`; the form's own limit is unchanged.

## Context

`view-screen` returns the open form, the selected field (`navigation.fieldId`) and pending proposals. "This one" means that field; "#7" means `n=7`.

## Learning

After the founder edits a draft, `learn-from-edit` proposes a bank diff (new fact or better phrasing). Nothing is written until `apply-bank-update` accepts it.

## Don't

- Mark forms ready/submitted unprompted.
- Paste your own prose into a field unless the founder dictated it.
- Use raw SQL or any path other than the actions.
