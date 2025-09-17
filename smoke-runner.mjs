// Usage: node smoke-runner.mjs [BASE_URL]
// Default BASE_URL = http://localhost:3000/api/analyze-hand

import fs from "node:fs/promises";

const BASE_URL = process.argv[2] || "http://localhost:3000/api/analyze-hand";
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const gray = (s) => `\x1b[90m${s}\x1b[0m`;

function matchVerdict(actual, expected) {
  if (!expected) return true;
  const act = String(actual || "").toUpperCase();
  if (expected.verdict && act !== expected.verdict.toUpperCase()) return false;
  return true;
}

function sizeLooksLike(actual, needle) {
  if (!needle) return true;
  const a = String(actual || "").toLowerCase();
  const n = String(needle).toLowerCase();
  return a.includes(n);
}

async function run() {
  const raw = await fs.readFile("./smoke-tests.json", "utf8");
  const { tests } = JSON.parse(raw);

  let pass = 0;
  for (const t of tests) {
    const body = {
      date: new Date().toISOString().slice(0, 10),
      stakes: t.stakes,
      rawText: t.rawText,
      question: t.question
    };

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const out = await res.json();

    const okVerdict = matchVerdict(out.verdict, t.expected);
    const okSize = sizeLooksLike(out.size_hint, t.expected.size_like);
    const ok = okVerdict && okSize;

    if (ok) {
      pass++;
      console.log(
        `${green("PASS")} ${t.id}  → verdict=${out.verdict}  ${gray(out.size_hint || "")}`
      );
    } else {
      console.log(
        `${red("FAIL")} ${t.id}\n  expected: verdict=${t.expected.verdict}${
          t.expected.size_like ? ` (size~${t.expected.size_like})` : ""
        }\n  got     : verdict=${out.verdict}  size=${out.size_hint}\n  gto: ${gray(
          (out.gto_strategy || "").slice(0, 140).replace(/\n/g, " ")
        )}…`
      );
    }
  }

  console.log(
    `\n${pass}/${tests.length} passed. ${pass === tests.length ? green("✔︎") : red("✘")}`
  );
}

run().catch((e) => {
  console.error(red(e?.stack || e?.message || String(e)));
  process.exit(1);
});
