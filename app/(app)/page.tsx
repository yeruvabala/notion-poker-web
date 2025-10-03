'use client';
import { redirect } from 'next/navigation';
export default function Page(){ redirect('/login'); }

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveHandToSupabase } from '@/lib/saveToSupabase';
import SignOutButton from '@/components/SignOutButton';
import Link from 'next/link';

/* ====================== Local Error Boundary ====================== */
class LocalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || 'Unknown error') };
  }
  componentDidCatch(err: any) {
    console.error('Render error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="p">
          <div className="wrap">
            <h1 className="title">Something went wrong</h1>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => this.setState({ hasError: false, message: undefined })}>
                Try again
              </button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

/* ====================== Types & helpers ====================== */

type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  hand_class?: string | null;
  source_used?: 'SUMMARY' | 'STORY' | null;
};

type RankSym = 'A'|'K'|'Q'|'J'|'T'|'9'|'8'|'7'|'6'|'5'|'4'|'3'|'2';
const RANKS: RankSym[] = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_WORD: Record<string, string> = {
  spade: '♠', spades: '♠', heart: '♥', hearts: '♥',
  diamond: '♦', diamonds: '♦', club: '♣', clubs: '♣'
};
const isRed = (s: string) => s === '♥' || s === '♦';
const suitColor = (suit: string) => (isRed(suit) ? '#dc2626' : '#111827');

function suitifyToken(tok: string): string {
  const t = (tok || '').trim();
  if (!t) return '';

  const m0 = t.match(/^([2-9tjqka])([♥♦♣♠])$/i);
  if (m0) return `${m0[1].toUpperCase()}${m0[2]}`;

  const m1 = t.replace(/[\s/]+/g, '').match(/^([2-9tjqka])([shdc])$/i);
  if (m1) return `${m1[1].toUpperCase()}${SUIT_MAP[m1[2].toLowerCase()]}`;

  const m2 = t.match(/^([2-9tjqka])\s*(?:of)?\s*(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m2) return `${m2[1].toUpperCase()}${SUIT_WORD[m2[2].toLowerCase()]}`;

  const m3 = t.match(/^([2-9tjqka])$/i);
  if (m3) return m3[1].toUpperCase();

  return '';
}
function prettyCards(line: string): string {
  return (line || '').split(/\s+/).map(suitifyToken).filter(Boolean).join(' ');
}
function CardText({ c }: { c: string }) {
  if (!c) return null;
  const suit = c.slice(-1);
  return <span style={{ fontWeight: 700, color: suitColor(suit) }}>{c}</span>;
}

/* ---------- story parsing ---------- */
function parseStakes(t: string): string {
  const m =
    t.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?(?:\s*\+\s*\$?\d+(?:\.\d+)?\s*(?:bb|bba|ante))?/i) ||
    t.match(/\d+bb\/\d+bb(?:\s*\+\s*\d+bb\s*bba)?/i);
  return m ? m[0] : '';
}
function parsePosition(t: string): string {
  const up = ` ${t.toUpperCase()} `;
  const POS = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of POS) if (up.includes(` ${p} `)) return p.replace('+', '+');
  return '';
}
function parseHeroCardsSmart(t: string): string {
  const s = (t || '').toLowerCase();
  let m = s.match(/\b(?:hero|i|holding|with|have|has)\b[^.\n]{0,30}?([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])/i);
  if (m) return prettyCards(`${m[1]} ${m[2]}`);
  const tokens = Array.from(s.matchAll(/([2-9tjqka][shdc♥♦♣♠])/ig)).map(x => x[0]).slice(0,2);
  if (tokens.length === 2) return prettyCards(tokens.join(' '));
  return '';
}
function parseBoardFromStory(t: string) {
  const src = (t || '').toLowerCase();
  const grab = (label: 'flop'|'turn'|'river') => {
    const rx = new RegExp(`\\b${label}\\b(?:\\s+is)?\\s*:?\\s*([^\\n]*)`, 'i');
    const m = src.match(rx);
    return m ? m[1] : '';
  };
  const takeCards = (line: string, n: number) => {
    if (!line) return [];
    const raw = line.replace(/[.,;|]/g, ' ').split(/\s+/).filter(Boolean);
    const cards: string[] = [];
    for (const tok of raw) {
      const c = suitifyToken(tok);
      if (c) cards.push(c);
      if (cards.length >= n) break;
    }
    return cards;
  };
  const flopLine  = grab('flop');
  const turnLine  = grab('turn');
  const riverLine = grab('river');
  const flopArr  = takeCards(flopLine, 3);
  const turnArr  = takeCards(turnLine, 1);
  const riverArr = takeCards(riverLine, 1);
  return { flop: flopArr.join(' '), turn: turnArr[0] || '', river: riverArr[0] || '' };
}
function parseActionHint(text: string): string {
  const s = text.toLowerCase().replace(/villian|villain/gi, 'villain');
  const riverLine = s.split('\n').find(l => /river|riv /.test(l));
  if (!riverLine) return '';
  const betMatch = riverLine.match(/(villain|btn|utg|sb|bb).{0,20}\bbet[s]?\b[^0-9%]*(\d{1,3})\s?%/i)
                || riverLine.match(/(villain|btn|utg|sb|bb).{0,20}\bbet[s]?\b[^a-z0-9]*(?:([1-4])\/([1-4]))\s*pot/i);
  if (betMatch) {
    if (betMatch[2] && betMatch[3]) {
      const p = Math.round((Number(betMatch[2]) / Number(betMatch[3])) * 100);
      return `RIVER: facing-bet ~${p}%`;
    }
    if (betMatch[2]) return `RIVER: facing-bet ~${betMatch[2]}%`;
  }
  if (/check(?:s|ed)?\s*(?:through)?/.test(riverLine)) return 'RIVER: check-through';
  return '';
}

/* ---------- hand class ---------- */
const PLACEHOLDER_SET = new Set(['J♣','J♠','T♦','4♠','4♣','9♣','9♠','3♣','3♠']);
function isPlaceholder(v: string | undefined) {
  const x = (v || '').trim();
  if (!x) return true;
  return PLACEHOLDER_SET.has(x);
}
function handClass(heroCards: string, flop: string, turn: string, river: string): string {
  const hero = heroCards.split(' ').filter(Boolean);
  const board = [flop, turn, river].join(' ').trim().split(' ').filter(Boolean);
  const all = [...hero, ...board];
  if (hero.length !== 2 || board.length < 3) return 'Unknown';
  const suit = (c: string) => c.slice(-1);
  const rank = (c: string) => c.slice(0, -1).toUpperCase();
  const counts: Record<string, number> = {};
  for (const c of all) counts[rank(c)] = (counts[rank(c)] || 0) + 1;
  const ranks = Object.values(counts).sort((a,b)=>b-a);
  const flush = (() => {
    const sCount: Record<string, number> = {};
    for (const c of all) sCount[suit(c)] = (sCount[suit(c)] || 0) + 1;
    return Object.values(sCount).some(n => n >= 5);
  })();
  const rankToVal: Record<string, number> = {
    A:14,K:13,Q:12,J:11,T:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2
  };
  const uniqVals = Array.from(new Set(all.map(rank).map(r=>rankToVal[r]).filter(Boolean))).sort((a,b)=>b-a);
  let straight = false;
  if (uniqVals.length >= 5) {
    let run = 1;
    for (let i=1;i<uniqVals.length;i++){
      if (uniqVals[i]===uniqVals[i-1]-1) { run++; if (run>=5) { straight=true; break; } }
      else if (uniqVals[i]!==uniqVals[i-1]) run=1;
    }
    if (!straight && uniqVals.includes(14)) {
      const wheel = [5,4,3,2,1].every(v => uniqVals.includes(v===1?14:v));
      if (wheel) straight = true;
    }
  }
  if (ranks[0]===4) return 'Quads';
  if (ranks[0]===3 && ranks[1]===2) return 'Full House';
  if (flush && straight) return 'Straight Flush';
  if (flush) return 'Flush';
  if (straight) return 'Straight';
  if (ranks[0]===3) return 'Trips';
  if (ranks[0]===2 && ranks[1]===2) return 'Two Pair';
  if (ranks[0]===2) return 'Pair';
  return 'High Card';
}

/* ====================== GTO Preview renderer ====================== */
const SECTION_HEADS = new Set([
  'SITUATION','RANGE SNAPSHOT','PREFLOP','FLOP','TURN','RIVER',
  'NEXT CARDS','WHY','COMMON MISTAKES','LEARNING TAGS',
  'DECISION','PRICE','BOARD CLASS','RECOMMENDATION','MIXED'
]);
function renderGTO(text: string) {
  const lines = (text || '').split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return <div className="muted">No strategy yet. Click Analyze or Edit.</div>;
  return (
    <div className="gtoBody">
      {lines.map((raw, i) => {
        const line = raw.trim();
        const m = line.match(/^([A-Z ]+):\s*(.*)$/);
        if (m && SECTION_HEADS.has(m[1].trim())) {
          return (
            <div key={i} className="gtoLine">
              <strong className="gtoHead">{m[1].trim()}:</strong>
              {m[2] ? <span className="gtoText"> {m[2]}</span> : null}
            </div>
          );
        }
        if (/^[-•]/.test(line)) return <div key={i} className="gtoBullet">{line.replace(/^\s*/, '')}</div>;
        return <div key={i} className="gtoLine">{line}</div>;
      })}
    </div>
  );
}

/* ====================== Page ====================== */

export default function Page() {
  const router = useRouter();
  const supabaseMaybe = createClient();

  const envMissing = !supabaseMaybe;
  const sb = supabaseMaybe as NonNullable<typeof supabaseMaybe>;

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<null | { id: string; email?: string }>(null);

  useEffect(() => {
    (async () => {
      if (envMissing) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setUser({ id: user.id, email: user.email ?? undefined });
      setAuthChecked(true);
    })();
  }, [router, sb, envMissing]);

  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [risk, setRisk] = useState<string>('');     // bb
  const [reward, setReward] = useState<string>(''); // bb
  const feNeeded = useMemo(() => {
    const r = parseFloat(risk);
    const w = parseFloat(reward);
    if (!isFinite(r) || !isFinite(w) || r < 0 || w <= 0) return '';
    const x = (r / (r + w)) * 100;
    return `${x.toFixed(1)}%`;
  }, [risk, reward]);

  const [flopPot, setFlopPot] = useState<string>(''); // bb
  const [behind, setBehind] = useState<string>('');   // bb
  const spr = useMemo(() => {
    const p = parseFloat(flopPot);
    const b = parseFloat(behind);
    if (!isFinite(p) || !isFinite(b) || p <= 0) return '';
    return (b / p).toFixed(1);
  }, [flopPot, behind]);

  const [mode, setMode] = useState<'CASH' | 'MTT' | ''>('CASH');
  const [stakes, setStakes] = useState<string>('');
  const [eff, setEff] = useState<string>('');
  const [position, setPosition] = useState<string>('');

  const [h1, setH1] = useState<string>('');   // hero card 1
  const [h2, setH2] = useState<string>('');   // hero card 2
  const [f1, setF1] = useState<string>('');   // flop 1
  const [f2, setF2] = useState<string>('');   // flop 2
  const [f3, setF3] = useState<string>('');   // flop 3
  const [tr, setTr] = useState<string>('');   // turn
  const [rv, setRv] = useState<string>('');   // river
  const [gtoEdit, setGtoEdit] = useState(false);

  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parsePosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoardFromStory(input),
    action_hint: parseActionHint(input)
  }), [input]);

  function syncFromStory() {
    if (!stakes && preview.stakes) setStakes(preview.stakes);
    if (!position && preview.position) setPosition(preview.position);
    const pcs = (preview.heroCards || '').split(' ').filter(Boolean);
    if ((!h1 || !h2) && pcs.length === 2) {
      if (!h1) setH1(pcs[0]); if (!h2) setH2(pcs[1]);
    }
    const arr = (preview.board.flop || '').split(' ').filter(Boolean);
    if ((!f1 && !f2 && !f3) && arr.length === 3) { setF1(arr[0]); setF2(arr[1]); setF3(arr[2]); }
    if (!tr && preview.board.turn) setTr(preview.board.turn);
    if (!rv && preview.board.river) setRv(preview.board.river);
  }

  const sourceUsed: 'SUMMARY' | 'STORY' = useMemo(() => {
    const heroOK = (!isPlaceholder(h1) && !!suitifyToken(h1)) && (!isPlaceholder(h2) && !!suitifyToken(h2));
    const flopOK = (!isPlaceholder(f1) && !!suitifyToken(f1)) && (!isPlaceholder(f2) && !!suitifyToken(f2)) && (!isPlaceholder(f3) && !!suitifyToken(f3));
    const turnOK = (!isPlaceholder(tr) && !!suitifyToken(tr));
    const riverOK = (!isPlaceholder(rv) && !!suitifyToken(rv));
    return (heroOK || flopOK || turnOK || riverOK) ? 'SUMMARY' : 'STORY';
  }, [h1,h2,f1,f2,f3,tr,rv]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const heroCardsStr = useMemo(() => {
    if (sourceUsed === 'SUMMARY') {
      const a = suitifyToken(h1); const b = suitifyToken(h2);
      return [a, b].filter(Boolean).join(' ');
    }
    return preview.heroCards || '';
  }, [sourceUsed, h1, h2, preview.heroCards]);

  const flopStr = useMemo(() => {
    if (sourceUsed === 'SUMMARY') {
      const a = suitifyToken(f1), b = suitifyToken(f2), c = suitifyToken(f3);
      return [a, b, c].filter(Boolean).join(' ');
    }
    return preview.board.flop || '';
  }, [sourceUsed, f1, f2, f3, preview.board.flop]);

  const turnStr = useMemo(() => (sourceUsed === 'SUMMARY' ? suitifyToken(tr) : preview.board.turn || ''), [sourceUsed, tr, preview.board.turn]);
  const riverStr = useMemo(() => (sourceUsed === 'SUMMARY' ? suitifyToken(rv) : preview.board.river || ''), [sourceUsed, rv, preview.board.river]);

  const actionHint = useMemo(() => preview.action_hint || '', [preview.action_hint]);

  const derivedHandClass = useMemo(() => handClass(heroCardsStr, flopStr, turnStr, riverStr), [heroCardsStr, flopStr, turnStr, riverStr]);

    async function analyze() {
    setError(null);
    setStatus(null);
    setAiLoading(true);
    try {
      const board = [
        flopStr && `Flop: ${flopStr}`,
        turnStr && `Turn: ${turnStr}`,
        riverStr && `River: ${riverStr}`,
      ].filter(Boolean).join('  |  ');

      const payload = {
        date: today,
        stakes: stakes || preview.stakes || undefined,
        position: (position || preview.position || '').toUpperCase() || undefined,
        cards: heroCardsStr || undefined,
        board: board || undefined,
        notes: input || undefined,
        rawText: input || undefined,
        fe_hint: feNeeded || undefined,
        spr_hint: spr || undefined,
        action_hint: actionHint || undefined,
        hand_class: derivedHandClass || undefined,
        source_used: sourceUsed
      };

      // NEW: include the current access token so the API can authenticate you
      const { data: sessionData } = await sb.auth.getSession();
      const access = sessionData?.session?.access_token;

      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Analyze failed (${r.status})`);
      }

      const data = await r.json();
      setFields(prev => ({
        ...(prev ?? {}),
        gto_strategy: (data?.gto_strategy ?? '') || '',
        exploit_deviation: (data?.exploit_deviation ?? '') || '',
        learning_tag: Array.isArray(data?.learning_tag) ? data.learning_tag : [],
        date: today,
        stakes: payload.stakes || '',
        position: payload.position || '',
        cards: heroCardsStr,
        board,
        hand_class: derivedHandClass,
        source_used: sourceUsed
      }));
    } catch (e: any) {
      setError(e?.message || 'Analyze error');
    } finally {
      setAiLoading(false);
    }
  }


  async function saveToSupabaseHandler() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveHandToSupabase(fields, input || null);
      setStatus('Saved to Supabase ✅');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Render gates in JSX only (no early returns) ---------- */
  return (
    <LocalErrorBoundary>
      {envMissing ? (
        <main className="p">
          <div className="wrap">Missing Supabase env vars. See <code>/api/env-ok</code>.</div>
        </main>
      ) : !authChecked ? (
        <main className="p">
          <div className="wrap">Checking session…</div>
        </main>
      ) : (
        <main className="p">
          <div className="wrap">
            <div className="row end" style={{ marginBottom: 8 }}>
              <SignOutButton />
            </div>

             

            <div className="grid">
              {/* LEFT column */}
              <div className="col">
                {/* Story */}
                <section className="card">
                  <div className="cardTitle">Hand Played</div>
                  <textarea
                    className="textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Type your hand like a story — stakes, position, cards, actions…

Example:
Cash 6-max 100bb. BTN (Hero) 2.3x, BB calls.
Flop 8♠ 6♠ 2♦ — bet 50%, call.
Turn K♦ — ...`}
                  />
                  <div className="row gap">
                    <button className="btn primary" onClick={analyze} disabled={aiLoading || !input.trim()}>
                      {aiLoading ? 'Analyzing…' : 'Send'}
                    </button>
                    <button className="btn" onClick={syncFromStory} title="Copy parsed values from story">
                      Sync from Story
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        setInput(''); setFields(null); setStatus(null); setError(null);
                        setStakes(''); setEff(''); setPosition('');
                        setH1(''); setH2(''); setF1(''); setF2(''); setF3(''); setTr(''); setRv('');
                        setRisk(''); setReward(''); setFlopPot(''); setBehind('');
                      }}
                    >Clear</button>
                  </div>
                  {error && <div className="err">{error}</div>}
                </section>

                {/* Situation Summary */}
                <section className="card">
                  <div className="cardTitle">Situation Summary</div>

                  <div className="summaryGrid">
                    <Info label="Mode">
                      <select className="input" value={mode} onChange={e=>setMode(e.target.value as any)}>
                        <option value="CASH">CASH</option>
                        <option value="MTT">MTT</option>
                      </select>
                    </Info>

                    <Info label="Blinds / Stakes">
                      <input className="input" value={stakes} onChange={e=>setStakes(e.target.value)} placeholder={preview.stakes || '(unknown)'} />
                    </Info>

                    <Info label="Effective Stack (bb)">
                      <input className="input" value={eff} onChange={e=>setEff(e.target.value)} placeholder="(optional)" />
                    </Info>

                    <Info label="Positions">
                      <input className="input" value={position} onChange={e=>setPosition(e.target.value.toUpperCase())} placeholder={preview.position || '(unknown)'} />
                    </Info>

                    <Info label="Hero Hand">
                      <div className="cardsRow">
                        <CardEditor value={h1} onChange={setH1} placeholder={(preview.heroCards || '').split(' ')[0] || 'K♠'} />
                        <CardEditor value={h2} onChange={setH2} placeholder={(preview.heroCards || '').split(' ')[1] || 'K♦'} />
                      </div>
                    </Info>

                    <Info label="Board">
                      <div className="boardRow">
                        <span className="pillLbl">Flop</span>
                        <CardEditor value={f1} onChange={setF1} placeholder={(preview.board.flop || '').split(' ')[0] || 'J♠'} />
                        <CardEditor value={f2} onChange={setF2} placeholder={(preview.board.flop || '').split(' ')[1] || 'T♠'} />
                        <CardEditor value={f3} onChange={setF3} placeholder={(preview.board.flop || '').split(' ')[2] || '4♣'} />
                      </div>
                      <div className="boardRow">
                        <span className="pillLbl">Turn</span>
                        <CardEditor value={tr} onChange={setTr} placeholder={preview.board.turn || '9♣'} />
                      </div>
                      <div className="boardRow">
                        <span className="pillLbl">River</span>
                        <CardEditor value={rv} onChange={setRv} placeholder={preview.board.river || '3♠'} />
                      </div>
                    </Info>
                  </div>

                  <div className="hint">
                    <b>Source:</b> <span className="chip">{sourceUsed === 'SUMMARY' ? 'Using: Summary editors' : 'Using: Story parse'}</span>
                    &nbsp; • Postflop: add exact suits (e.g., <b>As 4s</b>) for accuracy. “Sync from Story” copies the parse below.
                  </div>
                  {actionHint && <div className="hint">Detected action: <b>{actionHint}</b></div>}
                </section>

                {/* FE & SPR */}
                <section className="card">
                  <div className="cardTitle">Fold-Equity Threshold & SPR</div>

                  <div className="feSprGrid">
                    <div className="box">
                      <div className="boxTitle">FE calculator (bb units)</div>
                      <div className="grid2">
                        <label className="lbl">Risk (bb)</label>
                        <input className="input" value={risk} onChange={e=>setRisk(e.target.value)} placeholder="e.g., jam = eff BB" />
                        <label className="lbl">Reward (bb)</label>
                        <input className="input" value={reward} onChange={e=>setReward(e.target.value)} placeholder="pre-pot + bet size" />
                      </div>
                      <div className="calcLine">
                        FE needed ≈ <b>{feNeeded || '0%'}</b> &nbsp;
                        <span className="muted">(Risk / (Risk + Reward))</span>
                      </div>
                    </div>

                    <div className="box">
                      <div className="boxTitle">SPR (flop)</div>
                      <div className="grid2">
                        <label className="lbl">Flop pot (bb)</label>
                        <input className="input" value={flopPot} onChange={e=>setFlopPot(e.target.value)} placeholder="e.g., 5.9" />
                        <label className="lbl">Behind (bb)</label>
                        <input className="input" value={behind} onChange={e=>setBehind(e.target.value)} placeholder="effective after prefl" />
                      </div>
                      <div className="calcLine">SPR ≈ <b>{spr || '0'}</b></div>
                      <div className="sprChips">
                        <span className="chip">SPR ≤ 2: jam / b50 / x</span>
                        <span className="chip">SPR 2–5: b33 / b50 / x</span>
                        <span className="chip">SPR 5+: b25–33 / x</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT column */}
              <div className="col">
                {/* top info */}
                <section className="card">
                  <div className="infoGrid">
                    <Info label="Date"><div>{today}</div></Info>
                    <Info label="Position"><div>{(position || preview.position) || <span className="muted">(unknown)</span>}</div></Info>
                    <Info label="Stakes"><div>{(stakes || preview.stakes) || <span className="muted">(unknown)</span>}</div></Info>
                    <Info label="Cards">
                      {heroCardsStr
                        ? heroCardsStr.split(' ').map((c,i)=>(
                            <span key={i} style={{marginRight:6}}><CardText c={c} /></span>
                          ))
                        : <span className="muted">(unknown)</span>
                      }
                    </Info>
                  </div>
                </section>

                {/* GTO Strategy */}
                <section className="card">
                  <div className="cardTitleRow">
                    <div className="cardTitle">GTO Strategy</div>
                    <span className="chip small">{sourceUsed === 'SUMMARY' ? 'Using: Summary editors' : 'Using: Story parse'}</span>
                    <button className="btn tiny" onClick={() => setGtoEdit(v => !v)} title={gtoEdit ? 'Finish editing' : 'Edit raw text'}>
                      {gtoEdit ? 'Done' : 'Edit'}
                    </button>
                  </div>

                  {gtoEdit ? (
                    <>
                      <textarea
                        className="textarea mono"
                        rows={12}
                        placeholder="Edit or add notes…"
                        value={fields?.gto_strategy ?? ''}
                        onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
                      />
                      <div className="muted small">Editing raw text. Click “Done” to return to the formatted preview.</div>
                    </>
                  ) : (
                    <>
                      <div className="gtoBox">{renderGTO(fields?.gto_strategy || '')}</div>
                      <div className="muted small">Preview only. Click “Edit” to change the text.</div>
                    </>
                  )}
                </section>

                {/* Exploits + buttons */}
                <section className="card">
                  <div className="cardTitle">Exploitative Deviations</div>
                  <ul className="list">
                    {(fields?.exploit_deviation || '')
                      .split(/(?<=\.)\s+/)
                      .filter(Boolean)
                      .map((s,i)=><li key={i}>{s}</li>)}
                  </ul>

                  <div className="row end gapTop">
                    <button className="btn" onClick={analyze} disabled={aiLoading}>
                      {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                    </button>
                    <button className="btn primary" onClick={saveToSupabaseHandler} disabled={!fields || saving}>
                      {saving ? 'Saving…' : 'Confirm & Save'}
                    </button>
                  </div>
                  {status && <div className="note">{status}</div>}
                </section>
              </div>
            </div>
          </div>

          {/* ===================== Styles ===================== */}
          <style jsx global>{`
            :root{
              --bg:#f3f4f6; --card:#ffffff; --line:#e5e7eb; --text:#0f172a; --muted:#6b7280;
              --primary:#2563eb; --primary2:#1d4ed8; --btnText:#f8fbff;
            }
            *{box-sizing:border-box}
            html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
            .p{padding:24px}
            .wrap{max-width:1200px;margin:0 auto}
            .title{margin:0 0 12px;font-size:28px;font-weight:800;text-align:center}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
            @media (max-width:980px){.grid{grid-template-columns:1fr}}

            .col{display:flex;flex-direction:column;gap:18px}
            .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
            .cardTitle{font-size:13px;font-weight:800;color:#111827;margin-bottom:8px}
            .cardTitleRow{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:8px}
            .textarea{width:100%;min-height:140px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
            .textarea.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace}
            .row{display:flex;align-items:center}
            .end{justify-content:flex-end}
            .gap{gap:10px}
            .gapTop{margin-top:10px}
            .btn{border:1px solid var(--line);background:#fff;padding:10px 14px;border-radius:12px;cursor:pointer}
            .btn.tiny{padding:6px 10px;border-radius:10px;font-size:12px}
            .btn.primary{background:linear-gradient(180deg,var(--primary),var(--primary2));color:var(--btnText);border-color:#9db7ff}
            .btn[disabled]{opacity:.6;cursor:not-allowed}
            .err{margin-top:10px;color:#b91c1c}
            .note{margin-top:10px;color:#166534}
            .muted{color:var(--muted)}
            .small{font-size:12px}

            .infoGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .summaryGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
            @media (max-width:900px){.summaryGrid{grid-template-columns:1fr}}

            .ibox{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;min-height:52px}
            .lblSmall{font-size:11px;color:#6b7280;margin-bottom:4px}
            .input{width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 10px}
            .cardsRow{display:flex;gap:8px;align-items:center}
            .boardRow{display:flex;gap:8px;align-items:center;margin-top:6px}
            .pillLbl{font-size:12px;color:#6b7280;min-width:40px;text-align:right}

            .cardInput{width:64px;text-align:center;border:1px solid var(--line);border-radius:10px;padding:8px 8px}
            .cardInput:focus{outline:2px solid #bfdbfe}
            .cardEcho{margin-left:6px;font-size:14px}

            .hint{margin-top:8px;font-size:12px;color:#6b7280}
            .chip{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;background:#f8fafc}
            .chip.small{padding:4px 8px;font-size:11px}

            .feSprGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            @media (max-width:900px){.feSprGrid{grid-template-columns:1fr}}
            .box{border:1px solid var(--line);border-radius:12px;padding:10px}
            .boxTitle{font-size:12px;font-weight:700;margin-bottom:6px;color:#374151}
            .grid2{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center}
            .lbl{font-size:12px;color:#6b7280}
            .calcLine{margin-top:8px}
            .sprChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
            .list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}

            .gtoBox{border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;padding:12px}
            .gtoBody{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace;font-size:13.5px;line-height:1.45}
            .gtoLine{margin:2px 0}
            .gtoHead{font-weight:800}
            .gtoBullet{margin:2px 0 2px 12px}
          `}</style>
        </main>
      )}
    </LocalErrorBoundary>
  );
}

/* ====================== Small UI helpers ====================== */
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="lblSmall">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function CardEditor({
  value, onChange, placeholder
}: { value: string; onChange: (v: string)=>void; placeholder?: string }) {
  const [local, setLocal] = useState<string>(value || '');
  useEffect(()=>{ setLocal(value || ''); }, [value]);

  const norm = suitifyToken(local);
  const echo = norm
    ? <CardText c={norm} />
    : <span style={{color:'#9ca3af'}}>{placeholder || ''}</span>;

  return (
    <div style={{display:'flex',alignItems:'center'}}>
      <input
        className="cardInput"
        value={local}
        onChange={(e)=>setLocal(e.target.value)}
        onBlur={()=>onChange(suitifyToken(local))}
        placeholder={placeholder || 'A♠'}
      />
      <div className="cardEcho" title="Normalized">{echo}</div>
    </div>
  );
}
