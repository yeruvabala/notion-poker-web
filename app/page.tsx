'use client';
import { useState } from 'react';

/* ---------- Types ---------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;        // text like "1/3", "$2/$5"
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

/* ---------- Small UI bits with INLINE styles ---------- */
const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 12px',
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: .3,
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  color: '#1e3a8a',
  whiteSpace: 'nowrap'
};

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
  color: '#fff',
  border: 'none',
  boxShadow: '0 6px 14px rgba(37,99,235,.28)'
};

const lightBtn: React.CSSProperties = {
  background: '#f2f6ff',
  color: '#0f1c3a',
  border: '1px solid #dbe6ff'
};

const dangerGhostBtn: React.CSSProperties = {
  background: '#fff1f1',
  color: '#b91c1c',
  border: '1px solid #ffd3d3'
};

function LabelPill({ children }: { children: React.ReactNode }) {
  return <span style={pillStyle}>{children}</span>;
}

function Row({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{display:'flex', gap:14, alignItems:'flex-start', padding:'14px 0', borderTop:'1px dashed #e9edf7'}}>
      <div style={{minWidth:126}}><LabelPill>{label}</LabelPill></div>
      <div style={{flex:1}}>{children}</div>
    </div>
  );
}

function TagEditor({
  tags,
  onAdd,
  onClear
}: {
  tags: string[];
  onAdd: (t:string)=>void;
  onClear: ()=>void;
}) {
  const [txt, setTxt] = useState('');
  return (
    <>
      <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:8}}>
        {tags.length ? tags.map((t,i)=>
          <span key={i} style={{...pillStyle, background:'#e0e7ff', border:'1px solid #c7d2fe'}}>{t}</span>
        ) : <span style={{...pillStyle, opacity:.65}}>No tags</span>}
      </div>
      <div style={{display:'flex', gap:8}}>
        <input
          value={txt}
          onChange={e=>setTxt(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter' && txt.trim()){ onAdd(txt.trim()); setTxt(''); } }}
          placeholder="Add tag and press Enter"
          style={{
            flex:1, padding:'10px 12px', borderRadius:999, outline:'none',
            border:'1px solid #dbe6ff', background:'#fff'
          }}
        />
        <button
          onClick={()=>{ if(txt.trim()){ onAdd(txt.trim()); setTxt(''); } }}
          style={{padding:'9px 12px', borderRadius:999, border:'1px solid #dbe6ff', background:'#fff', fontWeight:800}}
        >
          Add
        </button>
        <button
          onClick={onClear}
          style={{padding:'9px 12px', borderRadius:999, border:'1px solid #dbe6ff', background:'#fff', fontWeight:800}}
        >
          Clear
        </button>
      </div>
    </>
  );
}

/* ============================================================
   PAGE
============================================================ */
export default function Page() {
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
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || aiLoading) return;
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

  function handleAnalyzeAgain() {
    if (fields && !aiLoading) analyzeParsedHand(fields);
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
    <main style={{fontFamily:'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', color:'#0f172a'}}>
      {/* Top nav */}
      <div style={{maxWidth:1100, margin:'0 auto', padding:'22px 20px 10px'}}>
        <h1 style={{margin:0, fontSize:28}}>Notion Poker Ingest</h1>
        <p style={{margin:0, color:'#334155'}}>Paste → <b>Send</b> → Analyze → Save</p>
      </div>

      <div style={{maxWidth:1100, margin:'0 auto', padding:'0 20px 28px'}}>
        <div style={{display:'grid', gap:20, gridTemplateColumns:'1fr 1fr'}}>
          {/* Left card */}
          <section style={{
            background:'#fff', border:'1px solid #e9edf7', borderRadius:16, padding:16,
            boxShadow:'0 10px 24px rgba(2,6,23,.05)'
          }}>
            <div style={{margin:'6px 0 8px', fontSize:12, fontWeight:900, letterSpacing:.35, color:'#1e40af'}}>HAND PLAYED</div>

            <textarea
              placeholder="Paste the hand history or describe the hand in plain English..."
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              style={{
                width:'100%', height:360, resize:'vertical', padding:'14px 16px',
                borderRadius:12, border:'1px solid #e9edf7', background:'#fff',
                outline:'none', fontSize:15, lineHeight:1.55
              }}
            />

            <div style={{display:'flex', gap:10, marginTop:12}}>
              <button
                onClick={handleSend}
                style={{
                  padding:'10px 18px', borderRadius:999, fontWeight:800, cursor:'pointer',
                  ...primaryBtn
                }}
              >
                {aiLoading ? 'Sending…' : 'Send'}
              </button>

              <button
                onClick={()=>{ setInput(''); setFields(null); setStatus(null); setAiError(null); }}
                style={{padding:'10px 18px', borderRadius:999, fontWeight:800, cursor:'pointer', ...dangerGhostBtn}}
              >
                Clear
              </button>
            </div>

            {aiError && <div style={{marginTop:10, color:'#ef4444', fontSize:13}}>⚠ {aiError}</div>}
            {status && <div style={{marginTop:10, color:'#334155', fontSize:13}}>{status}</div>}
          </section>

          {/* Right card */}
          <section style={{
            background:'#fbfcff', border:'1px solid #e9edf7', borderRadius:16, padding:16,
            boxShadow:'0 10px 24px rgba(2,6,23,.05)'
          }}>
            {!fields ? (
              <div style={{textAlign:'center', color:'#334155', padding:'40px 0'}}>
                <div style={{fontSize:38, marginBottom:8}}>🃏</div>
                <div style={{fontWeight:800, color:'#0f172a'}}>Nothing parsed yet</div>
                <div style={{marginTop:6}}>Paste a hand on the left and hit <b>Send</b>.</div>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'6px 6px 10px'}}>
                  <div style={{fontSize:20, fontWeight:900}}>{fields.date || 'New Page'}</div>
                  <div style={{fontSize:14, color:'#334155'}}>{(fields.stakes || '—')} • {fields.cards || '—'}</div>
                </div>

                {/* Attribute rows */}
                <div>
                  <Row label="Cards"><div>{fields.cards || '—'}</div></Row>
                  <Row label="Date"><div>{fields.date || '—'}</div></Row>

                  {/* FULL TEXT (no truncation) */}
                  <Row label="Exploit Deviation">
                    <div style={{whiteSpace:'pre-wrap', lineHeight:1.55}}>
                      {fields.exploit_deviation || '—'}
                    </div>
                  </Row>

                  {/* FULL TEXT (no truncation) */}
                  <Row label="GTO Strategy">
                    <div style={{whiteSpace:'pre-wrap', lineHeight:1.55}}>
                      {fields.gto_strategy || '—'}
                    </div>
                  </Row>

                  <Row label="Learning Tag">
                    <TagEditor
                      tags={fields.learning_tag ?? []}
                      onAdd={(t)=>setFields({...fields!, learning_tag:[...(fields!.learning_tag ?? []), t]})}
                      onClear={()=>setFields({...fields!, learning_tag:[]})}
                    />
                  </Row>
                  <Row label="Position"><div>{fields.position || '—'}</div></Row>
                  <Row label="Stakes"><div>{fields.stakes || '—'}</div></Row>
                  <Row label="Villain Action"><div style={{whiteSpace:'pre-wrap'}}>{fields.villain_action || '—'}</div></Row>
                </div>

                {/* Footer buttons */}
                <div style={{display:'flex', gap:10, justifyContent:'flex-end', marginTop:16}}>
                  <button
                    onClick={handleAnalyzeAgain}
                    style={{padding:'10px 18px', borderRadius:999, fontWeight:800, cursor:'pointer', ...lightBtn}}
                  >
                    {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding:'10px 18px', borderRadius:999, fontWeight:800, cursor:'pointer',
                      ...(saving ? { background:'#e6ecff', color:'#26324d', border:'1px solid #dfe7ff' } : primaryBtn)
                    }}
                  >
                    {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
