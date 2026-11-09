import type { BankFact } from "./types";

/**
 * Fictional demo founder and startup. Not a real person or company.
 * Note what the bank deliberately does NOT contain: any revenue figure,
 * phone number, wallet address, ID or tax number.
 */
export interface SeedEntry {
  id: string;
  topic: string;
  title: string;
  answer: string;
  facts: BankFact[];
}

export const SEED_BANK: SeedEntry[] = [
  {
    id: "bank_one_liner",
    topic: "one-liner",
    title: "One-liner",
    answer:
      "Tidewell turns the supplier emails, texts and voicemails a restaurant already receives into ready-to-send purchase orders, so owners stop re-typing orders at 11pm.",
    facts: [
      { key: "company", value: "Tidewell", source: "Company name" },
      { key: "category", value: "Back-office automation for independent restaurants", source: "Positioning doc" },
    ],
  },
  {
    id: "bank_problem",
    topic: "problem",
    title: "Problem",
    answer:
      "Independent restaurant owners and kitchen managers order from five to fifteen suppliers, and each supplier wants orders a different way: a WhatsApp message, an email, a call, a portal login. Orders live in a notebook, a camera roll and the owner's head. Mistakes mean missing produce on a Saturday, double deliveries and invoices nobody can reconcile. The people doing this work are the owner and the head chef, after service, unpaid. Existing procurement tools ask every supplier to change how they work, so small suppliers ignore them.",
    facts: [{ key: "customer", value: "Owner-operators and head chefs at independent restaurants", source: "Customer interviews" }],
  },
  {
    id: "bank_solution",
    topic: "product",
    title: "Product and differentiation",
    answer:
      "Tidewell meets suppliers where they already are. Staff forward or dictate an order in plain language; Tidewell extracts items, quantities and units, matches them to the supplier's catalogue, and sends a clean purchase order back through the channel that supplier already uses. Nothing changes for the supplier. Owners get an order history and a weekly spend summary without data entry. Unlike supplier portals and procurement suites, there is no onboarding for the supplier side.",
    facts: [],
  },
  {
    id: "bank_traction",
    topic: "traction",
    title: "Traction",
    answer:
      "Our private beta opened in September 2026. Nine restaurants are piloting Tidewell today and 112 more are on the waitlist, mostly from referrals by pilot owners. Three of the nine pilots have moved to a paid plan. We have not yet reached meaningful recurring revenue and we do not report a revenue figure.",
    facts: [
      { key: "active pilots", value: "9", source: "Pilot tracker, Nov 2026" },
      { key: "waitlist", value: "112", source: "Waitlist export, Nov 2026" },
      { key: "paid pilots", value: "3", source: "Pilot tracker, Nov 2026" },
      { key: "beta opened", value: "September 2026", source: "Launch post" },
    ],
  },
  {
    id: "bank_team",
    topic: "team",
    title: "Team",
    answer:
      "Asha Rivera (CEO) spent six years in restaurant operations, most recently running purchasing for a three-location group. Leo Tanaka (CTO) is a backend engineer who built supplier and logistics integrations at a food-distribution software company. We are two full-time founders plus one part-time product designer, and we have worked together since early 2026.",
    facts: [
      { key: "founders", value: "Asha Rivera (CEO), Leo Tanaka (CTO)", source: "Team page" },
      { key: "team size", value: "2 full-time founders and 1 part-time designer", source: "Team page" },
    ],
  },
  {
    id: "bank_why_now",
    topic: "why now",
    title: "Why now",
    answer:
      "Two shifts landed together. Language models can now read messy, abbreviated supplier messages and turn them into structured orders reliably enough to trust with a human check. And small suppliers have moved from phone calls to WhatsApp and email, so there is finally a text trail to work from. Five years ago this needed custom per-supplier parsers; today it is one pipeline.",
    facts: [],
  },
  {
    id: "bank_roadmap",
    topic: "roadmap",
    title: "Roadmap",
    answer:
      "Next six months: inventory-aware reorder suggestions so Tidewell proposes tomorrow's order from yesterday's covers; supplier price tracking that flags creeping price changes; and integrations with the two most common restaurant point-of-sale systems. After that, a supplier-side view for the largest distributors who want structured orders.",
    facts: [{ key: "horizon", value: "6 months", source: "Roadmap doc" }],
  },
  {
    id: "bank_use_of_funds",
    topic: "use of funds",
    title: "Use of funds",
    answer:
      "Roughly 60% on engineering (two more engineers for integrations and extraction quality), 25% on pilot onboarding and customer success so every pilot gets set up by a human, and 15% on legal, accounting and operations. The goal is to grow from nine pilots to a cohort of paying restaurants that proves repeatable onboarding.",
    facts: [
      { key: "engineering share", value: "60%", source: "Budget plan" },
      { key: "onboarding share", value: "25%", source: "Budget plan" },
      { key: "ops share", value: "15%", source: "Budget plan" },
    ],
  },
  {
    id: "bank_tech",
    topic: "tech stack",
    title: "Tech stack",
    answer:
      "TypeScript end to end: React front end, Node services, Postgres. Claude models extract order lines from messy supplier messages, with deterministic validation against each supplier's catalogue. Orders go out over the WhatsApp Business API, SMTP and Twilio SMS. Hosted on managed Postgres and a container platform.",
    facts: [{ key: "stack", value: "TypeScript, React, Node, Postgres, Claude, WhatsApp Business API, Twilio", source: "Engineering README" }],
  },
  {
    id: "bank_links",
    topic: "links",
    title: "Links and contact",
    answer: "Tidewell website, demo video, code repository and primary contact.",
    facts: [
      { key: "website", value: "https://tidewell.example", source: "Company site" },
      { key: "demo video", value: "https://tidewell.example/demo", source: "Company site" },
      { key: "github", value: "https://github.com/tidewell-demo/tidewell", source: "Repo" },
      { key: "contact email", value: "asha@tidewell.example", source: "Team page" },
    ],
  },
  {
    id: "bank_company",
    topic: "company",
    title: "Company basics",
    answer:
      "Tidewell Labs was founded in March 2026 and is based in Lisbon, Portugal. Stage: pilot with paying customers.",
    facts: [
      { key: "legal name", value: "Tidewell Labs", source: "Incorporation docs" },
      { key: "founded", value: "March 2026", source: "Incorporation docs" },
      { key: "location", value: "Lisbon, Portugal", source: "Incorporation docs" },
      { key: "stage", value: "Pilot with customers", source: "Pilot tracker" },
    ],
  },
];
