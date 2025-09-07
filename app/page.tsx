'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;                 // <-- text
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;         // <-- correct key only
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,        // string
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? undefined,
        board: parsed.board ?? '',
        notes: parsed.notes ?? '',
      };

      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            : typeof data.learning_tag === 'string'
              ? data.learning_tag.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
        return {
          ...base,
          gto_strategy: data.gto_strategy || '',
          exploit_deviation: data.exploit_deviation || '',
          learning_tag: tags,
        };
      });
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleParse() {
    setStatus(null);
    setAiError(null);
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    const data: Fields = await res.json();
    setFields(data);
    if (data) analyzeParsedHand(data);
  }

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      const data = await res.json();
      if (data.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data.error || 'Failed');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center bg-gray-50">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Notion Poker Ingest</h1>

        <textarea
          className="w-full h-40 p-3 border rounded-md bg-white"
          placeholder="Paste your hand history or notes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleParse}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            disabled={!input.trim()}
          >
            {aiLoading ? 'Parsing…' : 'Parse'}
          </button>
          <button
            onClick={() => { setFields(null); setInput(''); setStatus(null); setAiError(null); }}
            className="px-4 py-2 rounded border"
          >
            Clear
          </button>
        </div>

        {fields && (
          <div className="mt-6 p-4 bg-white border rounded-md">
            <h2 className="font-medium mb-3">Review &amp; Edit (nothing is saved yet)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <L label="Date">
                <input
                  type="date"
                  value={fields.date ?? ''}
                  onChange={e=>setFields({ ...fields, date: e.target.value })}
                  className="input"
                />
              </L>

              <L label="Stakes (text)">
                <input
                  type="text"
                  value={fields.stakes ?? ''}
                  onChange={e=>setFields({ ...fields, stakes: e.target.value })}
                  className="input"
                />
              </L>

              <L label="Position">
                <select
                  value={fields.position ?? ''}
                  onChange={e=>setFields({ ...fields, position: e.target.value || null })}
                  className="input"
                >
                  <option value="">—</option>
                  {['UTG','MP','CO','BTN','SB','BB'].map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </L>

              <L label="Cards">
                <input
                  value={fields.cards ?? ''}
                  onChange={e=>setFields({ ...fields, cards: e.target.value })}
                  className="input"
                />
              </L>

              <L label="Villain Action">
                <textarea
                  rows={3}
                  value={fields.villain_action ?? ''}
                  onChange={e=>setFields({ ...fields, villain_action: e.target.value })}
                  className="input"
                />
              </L>

              <L label="GTO Strategy">
                <textarea
                  rows={3}
                  value={fields.gto_strategy ?? ''}
                  onChange={e=>setFields({ ...fields, gto_strategy: e.target.value })}
                  className="input"
                />
              </L>

              <L label="Exploit Deviation">
                <textarea
                  rows={3}
                  value={fields.exploit_deviation ?? ''}
                  onChange={e=>setFields({ ...fields, exploit_deviation: e.target.value })}
                  className="input"
                />
              </L>

              <L label="Learning Tag (comma separated)">
                <input
                  value={(fields.learning_tag??[]).join(', ')}
                  onChange={e=>setFields({
                    ...fields,
                    learning_tag: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                  })}
                  className="input"
                />
              </L>
            </div>

            <div className="mt-2 text-sm">
              {aiLoading && <span className="text-gray-500">Analyzing hand with AI…</span>}
              {aiError && <span className="text-rose-600">{aiError}</span>}
            </div>

            <div className="mt-4 flex gap-2 items-center">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
              >
                {saving? 'Saving…' : 'Confirm & Save to Notion'}
              </button>
              {status && <span className="text-sm">{status}</span>}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .input { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem 0.75rem; background: white; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji; }
      `}</style>
    </main>
  );
}

function L({label, children}:{label:string, children: any}){
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
