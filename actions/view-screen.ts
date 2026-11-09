import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import {
  getFormDTO,
  listBank,
  listEvidence,
  listFormSummaries,
} from "../server/lib/formfit/store.js";
import { measure } from "../shared/fit.js";

export default defineAction({
  description:
    "Read what the user is looking at in Formfit: the current form (all fields with status, char count vs limit, provenance, needs-you reasons), the SELECTED field (navigation.fieldId) with its full detail, pending bank-update proposals, and a bank summary. Call this first when the user says 'this one', 'this field', '#7', or 'everything'.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = (await readAppState("navigation")) as
      (Record<string, unknown> & { formId?: string; fieldId?: string }) | null;
    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;

    const bank = await listBank();
    screen.bank = bank.map((e) => ({
      id: e.id,
      topic: e.topic,
      facts: e.facts.map((f) => f.key),
    }));

    const evidence = await listEvidence();
    screen.evidence = {
      total: evidence.length,
      recent: evidence.slice(0, 15).map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        date: e.date.slice(0, 10),
      })),
    };

    let formId = navigation?.formId;
    if (!formId) formId = (await listFormSummaries())[0]?.id;
    const form = formId ? await getFormDTO(formId) : null;
    if (form) {
      screen.form = {
        id: form.id,
        title: form.title,
        status: form.status,
        needsYou: form.needsYou,
        fields: form.fields.map((f) => ({
          n: f.position + 1,
          id: f.id,
          label: f.label,
          kind: f.kind,
          status: f.status,
          limit: f.charLimit
            ? `${f.chars}/${f.charLimit} chars`
            : f.wordLimit
              ? `${f.words}/${f.wordLimit} words`
              : null,
          needsReason: f.needsReason,
          unsupportedClaims: f.claims.filter((c) => !c.supported).length,
        })),
        pendingProposals: form.proposals.map((p) => ({
          id: p.id,
          fieldId: p.fieldId,
          summary: p.summary,
        })),
      };
      const selected = navigation?.fieldId
        ? form.fields.find((f) => f.id === navigation.fieldId)
        : undefined;
      if (selected) {
        screen.selectedField = {
          ...selected,
          measure: measure(selected.answer, selected),
        };
      }
    } else {
      screen.note =
        "No form is open. The user can paste a form or click 'Load sample'; you can call load-sample or import-form.";
    }
    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app running?";
    }
    return screen;
  },
});
