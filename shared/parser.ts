import type { FieldKind, ParsedField } from "./types";

export interface ParsedForm {
  title: string;
  description: string;
  fields: ParsedField[];
}

const NOISE =
  /^(submit|next|back|previous|continue|save( draft)?|clear form|page \d+( of \d+)?|\d+ ?\/ ?\d+|\* ?indicates required( question| field)?|powered by .*|privacy|terms|sign in|log ?in|apply now|required fields? .*|all fields are required\.?)$/i;

const BULLET = /^(?:[•◦○◯▢☐□●▪‣]|[-–—]\s+(?=\S)|\(\s?\)|\[\s?\])\s*/;
const SELECT_HINT =
  /^(?:\(?(?:select|choose|pick)(?: one| an option| from| a)?[^)]*\)?|-+\s*select\s*-+|dropdown:?.*|select\.{0,3})$/i;

interface Limit {
  chars: number | null;
  words: number | null;
}

const LIMIT_PATTERNS: Array<{ re: RegExp; unit: "chars" | "words" }> = [
  {
    re: /\b(?:max(?:imum)?(?:\.| of)?|up to|limit(?:ed)?(?: to| of)?|at most|within|no more than|under|<=?)\s*[:\-]?\s*(\d[\d,]*)\s*(characters?|chars?|words?)\b/i,
    unit: "chars",
  },
  {
    re: /\b(\d[\d,]*)\s*(characters?|chars?|words?)\s*(?:max(?:imum)?|limit|or (?:less|fewer))\b/i,
    unit: "chars",
  },
  { re: /\b(\d[\d,]*)\s*[-–]?\s*(character|char|word)\s+limit\b/i, unit: "chars" },
  { re: /\b0\s*\/\s*(\d[\d,]*)\b/, unit: "chars" },
  { re: /\((\d[\d,]*)\s*(characters?|chars?|words?)\)/i, unit: "chars" },
  { re: /\b(\d[\d,]*)\s*(characters?|chars?|words?)\b/i, unit: "chars" },
];

/** Pull a char/word limit out of a line. Returns the limit and the line with it removed. */
export function extractLimit(line: string): Limit & { rest: string } {
  for (const p of LIMIT_PATTERNS) {
    const m = line.match(p.re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    const unitText = (m[2] ?? "chars").toLowerCase();
    const isWords = unitText.startsWith("word");
    const rest = line
      .replace(m[0], " ")
      .replace(/\(\s*[,;:.\-]*\s*\)/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[\s,;:\-–]+$/, "")
      .trim();
    return {
      chars: isWords ? null : n,
      words: isWords ? n : null,
      rest,
    };
  }
  return { chars: null, words: null, rest: line };
}

function isPureLimitLine(line: string): boolean {
  const { chars, words, rest } = extractLimit(line);
  if (chars == null && words == null) return false;
  const leftover = rest.replace(/[()\[\]\s.,;:\-*]/g, "").toLowerCase();
  return leftover === "" || /^(required|optional)$/.test(leftover);
}

const REQUIRED_RE = /(?:^|\s)\*+\s*$|^\*+\s*|\(required\)|\brequired\b/i;
const OPTIONAL_RE = /\(optional\)|\boptional\b/i;

function stripMarkers(line: string): { text: string; required: boolean; optional: boolean } {
  const required = REQUIRED_RE.test(line);
  const optional = OPTIONAL_RE.test(line);
  const text = line
    .replace(/\(\s*required\s*\)/gi, "")
    .replace(/\(\s*optional\s*\)/gi, "")
    .replace(/\s*[-–:|]?\s*\brequired\b\s*$/i, "")
    .replace(/\s*[-–:|]?\s*\boptional\b\s*$/i, "")
    .replace(/^\*+\s*/, "")
    .replace(/\s*\*+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text, required, optional };
}

function looksLikeHelp(line: string): boolean {
  if (/\*\s*$/.test(line)) return false;
  return (
    line.length > 70 ||
    /^(e\.?g\.?|example|ex:|hint|note|please|tell us|we('| a)re|this (will|is)|your answer|used to|if you|you can|we will|we'll|be specific|keep it|include|links? to|a short|format:)/i.test(
      line,
    ) ||
    (/[.!]$/.test(line) && line.split(/\s+/).length > 6)
  );
}

function looksLikeLabel(line: string): boolean {
  const stripped = extractLimit(line).rest;
  if (stripped !== line && /[.!]$/.test(stripped)) return false;
  if (/[?:]$/.test(line) || /\*\s*$/.test(line)) return true;
  if (/^\d{1,2}[.)]\s+\S/.test(line)) return true;
  if (/^\(?(?:required|optional)\)?$/i.test(line)) return false;
  return line.length <= 70 && !/[.!]$/.test(line);
}

const KIND_RULES: Array<{ kind: FieldKind; re: RegExp }> = [
  { kind: "checkbox", re: /\b(i agree|i accept|i confirm|i certify|i acknowledge|i consent|agree to|accept the|terms (and|&) conditions|code of conduct)\b/i },
  { kind: "email", re: /\be-?mail\b/i },
  { kind: "date", re: /\b(date|deadline|dob|birthday|founded on|launch(ed)? on|when did you (start|launch|found))\b/i },
  { kind: "url", re: /\b(url|website|web site|link|links|linkedin|github|twitter|x\.com|profile|demo video|pitch deck|deck|portfolio|repo(sitory)?|figma|loom|youtube|calendly|notion)\b/i },
  { kind: "number", re: /\b(how many|number of|headcount|team size|amount|revenue|mrr|arr|users|customers|age|years|months|budget|price|valuation|\$|usd|inr|eur|%)\b/i },
];

export function inferKind(args: {
  label: string;
  help: string;
  charLimit: number | null;
  wordLimit: number | null;
  options: string[];
  selectHint: boolean;
}): FieldKind {
  const { label, help, charLimit, wordLimit, options, selectHint } = args;
  if (options.length >= 2 || selectHint) return "select";
  const labelOnly = label;
  const both = `${label} ${help}`;
  const checkbox = KIND_RULES[0].re.test(both);
  if (checkbox && !(charLimit || wordLimit)) return "checkbox";
  if (/^(describe|explain|tell us|why|what (problem|are you|does|do you|makes|inspired|changed)|how do|how does|how will|who are)\b/i.test(labelOnly) && !/\b(how many|what is your (name|email|url|website))\b/i.test(labelOnly)) {
    // narrative prompts are long unless the limit is tiny
    if (charLimit != null ? charLimit > 140 : wordLimit != null ? wordLimit > 25 : true) return "long";
  }
  for (const r of KIND_RULES.slice(1)) {
    if (!r.re.test(labelOnly)) continue;
    // A long-limit narrative that merely mentions a URL/number in the label is still long text.
    if ((charLimit ?? 0) > 200 || (wordLimit ?? 0) > 40) break;
    if (r.kind === "number" && /\b(describe|explain|tell us|traction|why|how do)\b/i.test(labelOnly)) break;
    if (r.kind === "url" && /\b(describe|explain|why|how)\b/i.test(labelOnly)) break;
    return r.kind;
  }
  if ((charLimit ?? 0) > 150 || (wordLimit ?? 0) > 25) return "long";
  if (charLimit || wordLimit) return "short";
  if (/\b(describe|explain|tell us|why|how will|how do|what problem|summary|overview|pitch|story|plan|roadmap|background)\b/i.test(labelOnly)) return "long";
  return "short";
}

export function parseFormText(raw: string): ParsedForm {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((l) => l.replace(/ /g, " ").trim());

  interface Draft {
    label: string;
    help: string[];
    required: boolean;
    optional: boolean;
    charLimit: number | null;
    wordLimit: number | null;
    options: string[];
    selectHint: boolean;
    inOptions: boolean;
  }

  const fields: Draft[] = [];
  const preamble: string[] = [];
  let cur: Draft | null = null;

  const startField = (labelLine: string) => {
    const lim = extractLimit(labelLine);
    const marks = stripMarkers(lim.rest);
    const label = marks.text
      .replace(/^\d{1,2}[.)]\s+/, "")
      .replace(/[:?]+\s*$/, (m) => (m.includes("?") ? "?" : ""))
      .trim();
    cur = {
      label,
      help: [],
      required: marks.required,
      optional: marks.optional,
      charLimit: lim.chars,
      wordLimit: lim.words,
      options: [],
      selectHint: false,
      inOptions: false,
    };
    fields.push(cur);
  };

  // Pasted forms usually separate fields with blank lines; help text hugs its label.
  const blankSeparated = lines.filter((l) => !l).length >= 3;
  let prevBlank = true;
  for (const line of lines) {
    const adjacent = !prevBlank;
    prevBlank = !line;
    if (!line) {
      if (cur) cur.inOptions = cur.inOptions && cur.options.length === 0 ? true : false;
      continue;
    }
    if (NOISE.test(line)) continue;

    // Required / optional on a line of its own, or a bare limit line.
    if (/^\(?\s*\*?\s*(required|optional)\s*\)?\s*\*?$/i.test(line)) {
      if (cur) {
        if (/required/i.test(line)) cur.required = true;
        else cur.optional = true;
      }
      continue;
    }
    if (cur && isPureLimitLine(line)) {
      const lim = extractLimit(line);
      cur.charLimit ??= lim.chars;
      cur.wordLimit ??= lim.words;
      if (/\brequired\b/i.test(line)) cur.required = true;
      continue;
    }

    // Options for a dropdown / radio group.
    if (cur) {
      const bullet = BULLET.test(line);
      if (bullet) {
        cur.options.push(line.replace(BULLET, "").trim());
        cur.inOptions = true;
        continue;
      }
      const inline = line.match(/^(?:options?|choices?|select(?: one)?|choose(?: one)?)\s*[:\-]\s*(.+)$/i);
      if (inline && /[,/|]/.test(inline[1])) {
        cur.options.push(...inline[1].split(/\s*[,/|]\s*/).map((s) => s.trim()).filter(Boolean));
        cur.selectHint = true;
        continue;
      }
      if (SELECT_HINT.test(line)) {
        cur.selectHint = true;
        cur.inOptions = true;
        continue;
      }
      if (cur.inOptions && !looksLikeHelp(line) && !/[?:]$|\*\s*$/.test(line) && line.length <= 48) {
        cur.options.push(line);
        continue;
      }
      cur.inOptions = false;
    }

    if (
      cur &&
      blankSeparated &&
      adjacent &&
      !/[?:*]\s*$/.test(line) &&
      !/^\d{1,2}[.)]\s/.test(line)
    ) {
      cur.help.push(line);
      continue;
    }

    const labelish = looksLikeLabel(line);
    const helpish = looksLikeHelp(line);
    const inlineLimit = extractLimit(line);
    const hasInlineLimit = inlineLimit.chars != null || inlineLimit.words != null;

    if (!cur && !labelish) {
      preamble.push(line);
      continue;
    }
    if (cur && (helpish && !/[?]$/.test(line) && !/^\d{1,2}[.)]\s/.test(line) && !(hasInlineLimit && inlineLimit.rest.length <= 90 && /[?:*]$/.test(inlineLimit.rest)))) {
      // Help text on its own: attach to the current field; limits inside help still count.
      cur.help.push(line);
      if (hasInlineLimit) {
        cur.charLimit ??= inlineLimit.chars;
        cur.wordLimit ??= inlineLimit.words;
      }
      if (/\brequired\b/i.test(line) && /\*|\(required\)/i.test(line)) cur.required = true;
      continue;
    }
    if (cur && !labelish) {
      cur.help.push(line);
      continue;
    }
    if (!cur && preamble.length === 0 && fields.length === 0 && !/[?:*]$/.test(line) && !hasInlineLimit && !/^\d{1,2}[.)]\s/.test(line)) {
      // First short line with no field markers is the form title.
      preamble.push(line);
      continue;
    }
    startField(line);
  }

  const out: ParsedField[] = fields
    .filter((f) => f.label)
    .map((f) => {
      const help = f.help.join(" ").replace(/\s{2,}/g, " ").trim();
      // Fall back to limits mentioned in help text.
      const helpLimit = extractLimit(help);
      const charLimit = f.charLimit ?? helpLimit.chars;
      const wordLimit = f.wordLimit ?? helpLimit.words;
      const options = [...new Set(f.options.filter(Boolean))];
      const kind = inferKind({
        label: f.label,
        help,
        charLimit,
        wordLimit,
        options,
        selectHint: f.selectHint && options.length > 0,
      });
      return {
        label: f.label,
        help,
        kind,
        charLimit,
        wordLimit,
        required: f.required && !f.optional,
        options: kind === "select" ? options : [],
      };
    });

  const title = preamble[0] ?? "Untitled form";
  const description = preamble.slice(1).join(" ").trim();
  return { title, description, fields: out };
}
