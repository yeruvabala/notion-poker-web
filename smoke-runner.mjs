// Smoke runner for OnlyPoker API — supports MIXED verdicts
// Usage:
//   node smoke-runner.mjs https://<your-deployment>.vercel.app/api/analyze-hand
// If no URL is provided, it defaults to http://localhost:3000/api/analyze-hand

import fs from "node:fs/promises";

const BASE_URL = process.argv[2] || "http://localhost:3000/api/analyze-hand";

// ANSI helpers
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const gray  = (s) => `\x1b[90m${s}\x1b[0m`;

// -------- verdict matching helpers --------

/**
 * Bucketize a numeric size (0..1) into SMALL/MEDIUM/LARGE
 */
function bucketFromPct(p) {
  if (!isFinite(p)) return "";
  if (p < 0.38) return "SMALL";
  if (p <= 0.62) return "MEDIUM";
  return "LARGE";
}

/**
 * Parse the "DECISION" section that your API returns in gto_strategy.
 * We look for an Action and (if present) a primary size.
 */
function parseActualVerdict(gtoStrategy = "") {
  const text = String(gtoStrategy || "");

  // Action: Call / Fold / Check / Bet / Raise
  let action = "";
  const mAction = text.match(/Action:\s*(Call|Fold|Check|Bet|Raise)/i);
  if (mAction) action = mAction[1].toUpperCase();

  // Try explicit % pot first
  let pct = null;
  const mPct = text.match(
    /(?:primary|size|bet(?:ting)?(?:\s*size)?)\D+(\d{1,3})\s*%/i
  );
  if (mPct) pct = Math.max(0, Math.min(100, Number(mPct[1]))) / 100;

  // If no numeric % was found, look for qualitative words
  // (we only use this when action is BET or RAISE)
  let bucket = "";
  if (pct != null) {
    bucket = bucketFromPct(pct);
  } else if (/small/i.test(text)) {
    bucket = "SMALL";
  } else if (/medium|mid/i.test(text)) {
    bucket = "MEDIUM";
  } else if (/large|big|pot\s*size|overbet/i.test(text)) {
    bucket = "LARGE";
  }

  // Compose a normalized tag like:  "BET:SMALL", "RAISE:MEDIUM", "CALL", "CHECK", "FOLD"
  let tag = action;
  if ((action === "BET" || action === "RAISE") && bucket) {
    tag = `${action}:${bucket}`;
  }
  return { action, tag, pct };
}

/**
 * Accepts either:
 *   expected = { verdict: "CALL" }
 *   expected = { verdict: "BET", size_like: "33%" }         // legacy single
 *   expected = { verdict: "MIXED", accept: ["RAISE:SMALL","CALL"] }
 */
function matchesExpected(actual, expected) {
  if (!expected) return true;

  // New MIXED format
  if (String(expected.verdict).toUpperCase() === "MIXED") {
    const accepts = Array.isArray(expected.accept) ? expected.accept : [];
    if (accepts.length === 0) return false;
    // Compare by exact tag, but also allow "CALL" to match "CALL" even if sizes present elsewhere
    return accepts.some((acc) => acc.toUpperCase() === actual.tag);
  }

  // Single verdict (legacy)
  const v = String(expected.verdict || "").toUpperCase();
  if (!v) return true;
  if (v !== actual.action) return false;

  // Optional size hint, accept either textual family or numeric proximity
  if (expected.size_like) {
    const hint = String(expected.size_like).toUpperCase();
    // If hint is "SMALL|MEDIUM|LARGE"
    if (/SMALL|MEDIUM|LARGE/.test(hint)) {
      return actual.tag === `${v}:${hint}`;
    }
    // If hint looks numeric (e.g., "33%")
    const m = hint.match(/(\d{1,3})\s*%/);
    if (m) {
      const wantPct = Math.max(0, Math.min(100, Number(m[1]))) / 100;
      const wantBucket = bucketFromPct(wantPct);
      return actual.tag === `${v}:${wantBucket}`;
    }
  }

  return true;
}

// -------- main ----------

const { tests } = JSON.parse(await fs.readFile("smoke-tests.json", "utf8"));

let pass = 0;
for (const t of tests) {
  const body = {
    date: new Date().toISOString().slice(0, 10),
    stakes: t.stakes,
    rawText: t.rawText,
  };

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    console.log(red(`FAIL ${t.id}`));
    console.log(gray("  could not parse JSON\n"));
    continue;
  }

  const { gto_strategy = "" } = data || {};
  const actual = parseActualVerdict(gto_strategy);

  const ok = matchesExpected(actual, t.expected);

  if (ok) {
    pass++;
    console.log(
      green(`PASS ${t.id}`) +
        gray(`  → verdict=${actual.tag || actual.action || "?"}  ${t.expected?.size_like ? t.expected.size_like : ""}`),
    );
  } else {
    console.log(red(`FAIL ${t.id}`));
    console.log(
      `  expected: ${JSON.stringify(t.expected)}\n` +
        `  got     : verdict=${actual.tag || actual.action || "?"}\n` +
        `  gto     : ${gto_strategy.split("\n")[0]?.trim()}…\n`,
    );
  }
}

console.log(
  `\n${pass}/${tests.length} passed. ` +
    (pass === tests.length ? green("✓") : red("✗")),
);
