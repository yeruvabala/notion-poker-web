'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: number | null;
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
};

export default function Home() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleParse() {
    setStatus(null);
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    const data = await res.json();
    setFields(data);
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
          <button onClick={handleParse} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!input.trim()}>Parse</button>
          <button onClick={() => { setFields(null); setInput(''); }} className="px-4 py-2 rounded border">Clear</button>
        </div>

        {fields && (
          <div className="mt-6 p-4 bg-white border rounded-md">
            <h2 className="font-medium mb-3">Review & Edit (nothing is saved yet)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <L label="Date"><input type="date" value={fields.date ?? ''} onChange={e=>setFields({ ...fields, date: e.target.value })} className="input"/></L>
              <L label="Stakes (number)"><input type="number" step="0.01" value={fields.stakes ?? ''} onChange={e=>setFields({ ...fields, stakes: e.target.value===''? null: Number(e.target.value) })} className="input"/></L>
              <L label="Position">
                <select value={fields.position ?? ''} onChange={e=>setFields({ ...fields, position: e.target.value || null })} className="input">
                  <option value="">—</option>
                  {['UTG','MP','CO','BTN','SB','BB'].map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </L>
              <L label="Cards"><input value={fields.cards ?? ''} onChange={e=>setFields({ ...fields, cards: e.target.value })} className="input"/></L>
              <L label="Villain Action"><textarea rows={3} value={fields.villain_action ?? ''} onChange={e=>setFields({ ...fields, villain_action: e.target.value })} className="input"/></L>
              <L label="GTO Strategy"><textarea rows={3} value={fields.gto_strategy ?? ''} onChange={e=>setFields({ ...fields, gto_strategy: e.target.value })} className="input"/></L>
              <L label="Exploit Deviation"><textarea rows={3} value={fields.exploit_deviation ?? ''} onChange={e=>setFields({ ...fields, exploit_deviation: e.target.value })} className="input"/></L>
              <L label="Learning Tag (comma separated)"><input value={(fields.learning_tag??[]).join(', ')} onChange={e=>setFields({ ...fields, learning_tag: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} className="input"/></L>
            </div>
            <div className="mt-4 flex gap-2 items-center">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">{saving? 'Saving…' : 'Confirm & Save to Notion'}</button>
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