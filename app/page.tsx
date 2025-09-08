"use client";
import { useState } from "react";

type Fields = {
  date?: string | null;
  stakes?: string | null;            // text format
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;

  gto_strategy?: string | null;      // concise 4 lines
  exploit_deviation?: string | null;
  learning_tag?: string[];

  gto_expanded?: string | null;      // full branch map

  // optional extras
  board?: string | null;
  notes?: string | null;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showExpanded, setShowExpanded] = useState(false);

  // Parse -> then run AI
  async function handleParse() {
    setStatus(null);
    setAiError(null);
    setShowExpanded(false);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!res.ok) throw new Error("Failed to parse");
      const data: Fields = await res.json();

      setFields(data);
      if (data) analyzeParsedHand(data);
    } catch (e: any) {
      setAiError(e.message || "Parse failed");
    }
  }

  // Call AI to get concise + expanded
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    setShowExpanded(false);

    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? undefined,
        board: parsed.board ?? undefined,
        notes: parsed.notes ?? undefined,
      };

      const r = await fetch("/api/analyze-hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `AI analyze failed (${r.status})`);
      }

      const data = await r.json();

      setFields(prev => {
        const base = prev ?? parsed ?? {};
        const tags: string[] = Array.isArray(data.learning_tag)
          ? data.learning_tag
          : typeof data.learning_tag === "string"
          ? data.learning_tag.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];

        return {
          ...base,
          gto_strategy: data.gto_strategy || "",
          exploit_deviation: data.exploit_deviation || "",
          learning_tag: tags,
          gto_expanded: data.gto_expanded || "",
        };
      });
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || "AI analysis error");
    } finally {
      setAiLoading(false);
    }
  }

  // Save to Notion
  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (data.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data.error || "Failed");
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 bg-gray-50 text-black">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Hand text (unchanged look) */}
        <section className="rounded-2xl bg-white shadow border border-black/10">
          <div className="px-5 pt-5 pb-3 text-sm uppercase tracking-wider text-gray-600">
            Hand Played
          </div>
          <div className="px-5 pb-4">
            <textarea
              className="w-full h-64 p-3 bg-white rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Paste the hand history or describe the hand in plain English..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleParse}
                disabled={!input.trim() || aiLoading}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {aiLoading ? "Analyzing…" : "Send"}
              </button>
              <button
                onClick={() => {
                  setInput("");
                  setFields(null);
                  setAiError(null);
                  setStatus(null);
                  setShowExpanded(false);
                }}
                className="px-4 py-2 rounded-xl border border-black/10 bg-white hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
            {aiError && (
              <div className="mt-3 text-rose-600 text-sm">{aiError}</div>
            )}
          </div>
        </section>

        {/* RIGHT: Parsed + AI results (unchanged look; only toggle added) */}
        <section className="rounded-2xl bg-white shadow border border-black/10 p-5">
          {/* Chips row (unchanged) */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(fields?.learning_tag ?? []).map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200"
              >
                {t}
              </span>
            ))}
          </div>

          <Row label="Cards">
            <input
              className="input"
              value={fields?.cards ?? ""}
              onChange={(e) =>
                setFields((f) => ({ ...(f ?? {}), cards: e.target.value }))
              }
              placeholder="A♠4♠"
            />
          </Row>

          <Row label="Position">
            <input
              className="input"
              value={fields?.position ?? ""}
              onChange={(e) =>
                setFields((f) => ({ ...(f ?? {}), position: e.target.value }))
              }
              placeholder="SB / BTN / BB …"
            />
          </Row>

          <Row label="Stakes">
            <input
              className="input"
              value={fields?.stakes ?? ""}
              onChange={(e) =>
                setFields((f) => ({ ...(f ?? {}), stakes: e.target.value }))
              }
              placeholder="1/3, 2/5 Live …"
            />
          </Row>

          <Row label="Villain Action">
            <textarea
              className="input min-h-[70px]"
              value={fields?.villain_action ?? ""}
              onChange={(e) =>
                setFields((f) => ({
                  ...(f ?? {}),
                  villain_action: e.target.value,
                }))
              }
              placeholder="raises to 2.5bb, calls 3-bet, calls flop bet, bets turn, bets river …"
            />
          </Row>

          {/* Concise GTO strategy (same box) */}
          <Row label="GTO Strategy">
            <textarea
              className="input min-h-[110px] font-mono"
              value={fields?.gto_strategy ?? ""}
              onChange={(e) =>
                setFields((f) => ({ ...(f ?? {}), gto_strategy: e.target.value }))
              }
              placeholder={`Preflop (SB vs CO, 150bb): ...
Flop 4♦8♠2♣ (OOP, 3-bet pot): ...
Turn 5♥: ...
River 9♥: ...`}
            />
          </Row>

          {/* NEW: Toggle for expanded details (just this feature added) */}
          <div className="mt-2">
            <button
              onClick={() => setShowExpanded((s) => !s)}
              className="text-sm px-3 py-1 rounded-lg border border-black/10 bg-white hover:bg-gray-50"
            >
              {showExpanded ? "Hide GTO Expanded" : "Show GTO Expanded"}
            </button>

            {showExpanded && (
              <div className="mt-3 p-3 rounded-xl border border-black/10 bg-gray-50">
                <pre className="whitespace-pre-wrap text-sm leading-6">
                  {fields?.gto_expanded?.trim() || "—"}
                </pre>
              </div>
            )}
          </div>

          <Row label="Exploit Deviation">
            <textarea
              className="input min-h-[90px]"
              value={fields?.exploit_deviation ?? ""}
              onChange={(e) =>
                setFields((f) => ({
                  ...(f ?? {}),
                  exploit_deviation: e.target.value,
                }))
              }
              placeholder="Pool exploits / deviations…"
            />
          </Row>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => fields && analyzeParsedHand(fields)}
              disabled={aiLoading}
              className="px-4 py-2 rounded-xl border border-black/10 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Analyze Again
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm & Save to Notion"}
            </button>

            {status && (
              <span className="text-xs text-gray-600">{status}</span>
            )}
          </div>
        </section>
      </div>

      {/* keep your original simple input style */}
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 0.75rem;
          padding: 0.6rem 0.8rem;
          background: #ffffff;
          outline: none;
        }
        .input:focus {
          border-color: rgba(59, 130, 246, 0.7);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
      `}</style>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </div>
      {children}
    </div>
  );
}
