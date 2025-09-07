'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;            // text, e.g. "1/3" or "$2/$5"
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
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

  // ---- AI: analyze parsed hand and fill GTO/Exploit/Tags ----
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
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

  // ---- Parse raw text with your /api/parse, then call analyzer ----
  async function handleParse() {
    setStatus(null);
    setAiError(null);
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data: Fields = await res.json();
    setFields(data);
    if (data) analyzeParsedHand(data);
  }

  // ---- Save to Notion ----
  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Notion Poker Ingest</h1>

        {/* 2-pane layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: big input box */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-2">Hand Text</div>
            <textarea
              className="w-full h-[420px] p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Paste your hand history or notes..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleParse}
                className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                disabled={!input.trim()}
              >
                {aiLoading ? 'Parsing…' : 'Parse'}
              </button>
              <button
                onClick={() => { setFields(null); setInput(''); setStatus(null); setAiError(null); }}
                className="px-4 py-2 rounded-lg border"
              >
                Clear
              </button>
            </div>
            {aiLoading && <div className="mt-2 text-sm text-gray-500">Analyzing hand with AI…</div>}
            {aiError && <div className="mt-2 text-sm text-rose-600">{aiError}</div>}
          </div>

          {/* Right: Notion-style detail card */}
          <div className="bg-white border rounded-xl overflow-hidden">
            {!fields ? (
              <div className="p-10 text-center text-gray-500">
                Paste text on the left and click <b>Parse</b> to preview here.
              </div>
            ) : (
              <>
                {/* Title bar */}
                <div className="px-6 pt-6 pb-2">
                  <div className="text-2xl font-semibold mb-1">
                    {fields.date || 'New page'}
                  </div>
                </div>

                <div className="px-6 pb-6 space-y-3">

                  <Property
                    name="Cards"
                    value={fields.cards ?? ''}
                    onChange={(v)=>setFields({ ...fields, cards: v })}
                  />

                  <Property
                    name="Date"
                    value={fields.date ?? ''}
                    type="date"
                    onChange={(v)=>setFields({ ...fields, date: v })}
                  />

                  <PropertyArea
                    name="Exploit Deviation"
                    value={fields.exploit_deviation ?? ''}
                    placeholder="Short, practical exploit notes…"
                    onChange={(v)=>setFields({ ...fields, exploit_deviation: v })}
                  />

                  <PropertyArea
                    name="GTO Strategy"
                    value={fields.gto_strategy ?? ''}
                    placeholder="Preflop/Flop/Turn/River plan…"
                    onChange={(v)=>setFields({ ...fields, gto_strategy: v })}
                  />

                  <PropertyTags
                    name="Learning Tag"
                    tags={fields.learning_tag ?? []}
                    onChange={(arr)=>setFields({ ...fields, learning_tag: arr })}
                  />

                  <Property
                    name="Position"
                    value={fields.position ?? ''}
                    onChange={(v)=>setFields({ ...fields, position: v })}
                  />

                  <Property
                    name="Stakes"
                    value={fields.stakes ?? ''}
                    onChange={(v)=>setFields({ ...fields, stakes: v })}
                  />

                  <PropertyArea
                    name="Villain Action"
                    value={fields.villain_action ?? ''}
                    onChange={(v)=>setFields({ ...fields, villain_action: v })}
                  />

                  <div className="pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                    >
                      {saving? 'Saving…' : 'Confirm & Save to Notion'}
                    </button>
                    {status && <span className="ml-3 text-sm">{status}</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* tiny global styles */}
      <style jsx global>{`
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji; }
      `}</style>
    </main>
  );
}

/* ---------- Small components for “Notion-like” property rows ---------- */

function Property({
  name, value, onChange, type='text', placeholder=''
}: { name:string; value:string; onChange:(v:string)=>void; type?:'text'|'date'; placeholder?:string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex items-start gap-4">
      <div className="w-40 shrink-0 text-gray-500">{name}</div>
      <div className="flex-1">
        {editing ? (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e)=>onChange(e.target.value)}
            onBlur={()=>setEditing(false)}
            className="w-full border rounded-lg px-3 py-2"
            autoFocus
          />
        ) : (
          <div
            className={`px-3 py-2 rounded-lg hover:bg-gray-50 cursor-text ${value ? 'text-gray-900' : 'text-gray-400'}`}
            onClick={()=>setEditing(true)}
            title="Click to edit"
          >
            {value || '—'}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyArea({
  name, value, onChange, placeholder=''
}: { name:string; value:string; onChange:(v:string)=>void; placeholder?:string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex items-start gap-4">
      <div className="w-40 shrink-0 text-gray-500">{name}</div>
      <div className="flex-1">
        {editing ? (
          <textarea
            rows={4}
            value={value}
            placeholder={placeholder}
            onChange={(e)=>onChange(e.target.value)}
            onBlur={()=>setEditing(false)}
            className="w-full border rounded-lg px-3 py-2"
            autoFocus
          />
        ) : (
          <div
            className={`px-3 py-2 rounded-lg hover:bg-gray-50 cursor-text whitespace-pre-wrap ${value ? 'text-gray-900' : 'text-gray-400'}`}
            onClick={()=>setEditing(true)}
            title="Click to edit"
          >
            {value || '—'}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyTags({
  name, tags, onChange
}: { name:string; tags:string[]; onChange:(t:string[])=>void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(tags.join(', '));
  const pills = (tags || []).map((t, i) => (
    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-sm bg-gray-100 text-gray-800 mr-1 mt-1">
      {t}
    </span>
  ));
  return (
    <div className="flex items-start gap-4">
      <div className="w-40 shrink-0 text-gray-500">{name}</div>
      <div className="flex-1">
        {editing ? (
          <input
            value={text}
            onChange={(e)=>setText(e.target.value)}
            onBlur={()=>{
              setEditing(false);
              onChange(text.split(',').map(s=>s.trim()).filter(Boolean));
            }}
            className="w-full border rounded-lg px-3 py-2"
            autoFocus
            placeholder="comma, separated, tags"
          />
        ) : (
          <div
            className="px-2 py-1 rounded-lg hover:bg-gray-50 cursor-text"
            onClick={()=>setEditing(true)}
            title="Click to edit"
          >
            {pills.length ? pills : <span className="text-gray-400">—</span>}
          </div>
        )}
      </div>
    </div>
  );
}
