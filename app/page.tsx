// inside your component in app/page.tsx

// Helper: make sure any value becomes a readable string
const asText = (v: any) =>
  typeof v === "string"
    ? v
    : v == null
      ? ""
      : Array.isArray(v)
        ? v.map(asText).join("\n")
        : typeof v === "object"
          ? Object.entries(v)
              .map(([k, val]) => `${k}: ${asText(val)}`)
              .join("\n")
          : String(v);

// Call /api/analyze-hand and fill GTO/Exploit/Tags
async function analyzeParsedHand(parsed: Fields) {
  setAiError(null);
  setAiLoading(true);
  try {
    const payload = {
      date: parsed.date ?? undefined,
      stakes: parsed.stakes ?? undefined,
      position: parsed.position ?? undefined,
      cards: parsed.cards ?? undefined,
      villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined, // tolerate typo
      board: parsed.board ?? "",
      notes: parsed.notes ?? "",
    } as any;

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
      const tags: string[] =
        Array.isArray(data.learning_tag)
          ? data.learning_tag
          : typeof data.learning_tag === "string"
            ? data.learning_tag.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];
      return {
        ...base,
        gto_strategy: asText(data.gto_strategy),
        exploit_deviation: asText(data.exploit_deviation),
        learning_tag: tags,
      };
    });
  } catch (e: any) {
    console.error(e);
    setAiError(e.message || "AI analysis error");
  } finally {
    setAiLoading(false);
  }
}
