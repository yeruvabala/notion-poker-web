'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ============================================================
   Constants / helpers
   ============================================================ */

type Pos = 'UTG'|'UTG+1'|'UTG+2'|'MP'|'HJ'|'CO'|'BTN'|'SB'|'BB';
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r,i)=>[r,i]));
const POS_ALIASES: Record<string, Pos> = {
  utg:'UTG', 'utg+1':'UTG+1', 'utg+2':'UTG+2', ep:'UTG', mp:'MP', hj:'HJ', 'hi-jack':'HJ',
  co:'CO', cutoff:'CO', btn:'BTN', button:'BTN', sb:'SB', smallblind:'SB', 'small blind':'SB',
  bb:'BB', bigblind:'BB', 'big blind':'BB'
};

function isPair(lbl: string){ return lbl.length===2 && lbl[0]===lbl[1]; }
function isSuited(lbl: string){ return lbl.endsWith('s'); }
function hi(lbl: string){ return isPair(lbl)? lbl[0] : lbl[0]; }
function lo(lbl: string){ return isPair(lbl)? lbl[1] : lbl[1]; }
function atLeast(a: string, b: string){ return rIndex[a] <= rIndex[b]; } // A high → lower index
function labelAt(i:number,j:number){
  const a = RANKS[i], b=RANKS[j];
  if (i===j) return `${a}${b}`;
  // upper triangle (j>i) → suited; lower → offsuit
  return j>i ? `${a}${b}s` : `${a}${b}o`;
}
const LABELS:string[] = (() => {
  const out:string[] = [];
  for (let i=0;i<13;i++) for (let j=0;j<13;j++) out.push(labelAt(i,j));
  return out;
})();

function emptyGrid(): Record<string,{raise:number;call:number;fold:number}> {
  const g: Record<string,{raise:number;call:number;fold:number}> = {};
  for (const L of LABELS) g[L] = { raise:0, call:0, fold:100 };
  return g;
}
function normalizeTo100(raise:number, call:number){
  const R = Math.max(0, Math.min(100, Math.round(raise)));
  const C = Math.max(0, Math.min(100, Math.round(call)));
  let F = 100 - R - C;
  if (F < 0) {
    const over = -F;
    if (C >= over) { F = 0; call = C - over; raise = R; }
    else { F = 0; raise = Math.max(0, R - (over - C)); call = 0; }
  } else { raise = R; call = C; }
  return { raise, call, fold: F };
}

/* ============================================================
   Parsing – positions, stack, preflop node
   ============================================================ */

type NodeKind =
  | 'RFI'
  | 'VS_OPEN'
  | 'SQUEEZE'
  | 'FACING_3BET'
  | 'CALLER_VS_3BET'
  | 'FACING_4BET'
  | 'LIMP_TREE'
  | 'BVB';

type ResolvedNode = {
  kind: NodeKind;
  hero: Pos;
  opener?: Pos;
  callers?: number;
  threeBettor?: Pos;
  fourBettor?: Pos;
  openSizeX?: number; // 2.5x etc
  confidence: number; // 0..1
};

function pickPosToken(s: string): Pos | null {
  const t = s.toLowerCase().replace(/[^a-z0-9\+\s]/g,' ');
  const keys = Object.keys(POS_ALIASES);
  for (const k of keys) {
    const rx = new RegExp(`\\b${k}\\b`, 'i');
    if (rx.test(t)) return POS_ALIASES[k];
  }
  return null;
}

function parseHeroPos(input: string): Pos | null {
  const m = input.match(/\b(hero|i am|i'm|am)\s+(on\s+)?(utg\+2|utg\+1|utg|mp|hj|co|cutoff|btn|button|sb|bb)\b/i);
  return m ? pickPosToken(m[3]) : null;
}

function parseOpener(input: string): Pos | null {
  // earliest explicit opener: "<pos> (opens|raises|makes it|min-raises)"
  const rx = /(utg\+2|utg\+1|utg|mp|hj|co|cutoff|btn|button|sb|bb)[^.\n\r]{0,25}\b(raises|opens|makes it|min-raises)\b/i;
  const m = input.match(rx);
  return m ? pickPosToken(m[1]) : null;
}

function parseOpenSizeX(input: string): number | undefined {
  // grab "2.5x" or "raises to 2.5 bb" → we normalise as X
  const x = input.match(/\b(\d+(?:\.\d+)?)\s*x\b/i);
  if (x) return parseFloat(x[1]);

  const toBB = input.match(/\braises?\s+to\s+(\d+(?:\.\d+)?)\s*bb\b/i);
  if (toBB) {
    // If "bb" is explicit, that's already in bb; map to X ≈ that size / 1bb
    return parseFloat(toBB[1]);
  }
  return undefined;
}

function parseStackBB(input: string, stakes?: string): number | null {
  // 150 bb eff.
  const bb = input.match(/(\d+)\s*bb\s*(?:eff|effective)?/i);
  if (bb) return parseInt(bb[1],10);

  // $300 eff in 1/3 → 100bb
  const eff$ = input.match(/\$?\s*(\d+)\s*(?:eff|effective)/i);
  const stk = stakes?.match(/(\d+(?:\.\d+)?)\s*[\/-]\s*(\d+(?:\.\d+)?)/);
  if (eff$ && stk) {
    const bb$ = parseFloat(stk[2] || stk[1]);
    if (bb$>0) return Math.round(parseFloat(eff$[1]) / bb$);
  }
  return null;
}

function countCallersBeforeHero(input: string): number {
  // very light heuristic (open + "calls" before a re-raise)
  const body = input.split(/\bflop\b/i)[0] || input;
  const afterOpen = body.split(/\b(raises|opens|makes it|min-raises)\b/i).slice(2).join(' ');
  if (!afterOpen) return 0;
  const m = afterOpen.match(/\bcalls?\b/ig);
  return m ? Math.min(m.length,3) : 0;
}

function saw3betBeforeHeroActs(input: string): boolean {
  const pre = input.split(/\bflop\b/i)[0] || input;
  return /\b(3\s*bet|3-bet|re-raise|reraise)\b/i.test(pre);
}

function resolveNode(input: string): ResolvedNode | null {
  const hero = parseHeroPos(input);
  const opener = parseOpener(input);
  const openSizeX = parseOpenSizeX(input);
  if (!hero) return null;

  // Limp lines (simple)
  if (/\blimp(s|ed)?\b/i.test(input) && !opener) {
    // SB complete / BB check / ISO etc — we won't print node name, just use ranges when needed
    return { kind:'LIMP_TREE', hero, confidence: 0.6 };
  }

  // Blind vs blind shortcut
  if (/folded\s+to\s+(sb|small blind)\b/i.test(input) || (hero==='SB' && !opener)) {
    return { kind:'BVB', hero, confidence: opener?0.7:0.5 };
  }

  // If opener is present before hero acts:
  if (opener) {
    const callers = countCallersBeforeHero(input);
    const pre = input.split(/\bflop\b/i)[0] || input;
    const heroActsLater = new RegExp(`\\b(?:i|hero)\\b[\\s\\S]{0,40}\\b(3\\s*bet|3-bet|raise|reraise)\\b`,'i').test(pre);
    if (callers>0 && heroActsLater) {
      return { kind:'SQUEEZE', hero, opener, callers, openSizeX, confidence: 0.9 };
    }
    // If 3-bet appears from villain before hero, we can be "facing 3-bet", otherwise vs open.
    if (saw3betBeforeHeroActs(input)) {
      return { kind:'FACING_3BET', hero, opener, openSizeX, confidence: 0.85 };
    }
    return { kind:'VS_OPEN', hero, opener, openSizeX, confidence: 0.95 };
  }

  // If no opener, but it’s folded to hero → RFI
  if (/fold(?:ed)?\s+to\s+(?:me|hero)/i.test(input) || /\b(unopened|all fold(?:ed)?)\b/i.test(input)) {
    return { kind:'RFI', hero, confidence: 0.8 };
  }

  // Fallback — if we can’t anchor clearly, return minimal node
  return { kind:'RFI', hero, confidence: 0.5 };
}

/* ============================================================
   Range engine (rule-based, stack & position aware)
   ============================================================ */

// Simple depth multipliers (smoother behavior with stack changes)
function depthFactor(stackBB: number){
  const t = Math.max(60, Math.min(300, stackBB));
  const shallow = t<=100, deep = t>=200;
  return {
    raiseMul: shallow? 1.15 : deep? 0.9 : 1.0,
    callMul: shallow? 0.9 : deep? 1.15 : 1.0,
  };
}
function seatScore(p: Pos){
  // lower is earlier pos; higher is later
  switch(p){
    case 'UTG': return 0; case 'UTG+1': return 1; case 'UTG+2': return 2; case 'MP': return 3;
    case 'HJ': return 4; case 'CO': return 5; case 'BTN': return 6; case 'SB': return 7; case 'BB': return 8;
  }
}

function gridRFI(pos: Pos, stackBB: number){
  const g = emptyGrid();
  const { raiseMul, callMul } = depthFactor(stackBB);
  const loosen = seatScore(pos)>=4 ? 1.0 : 0.85; // later positions open wider

  for (const L of LABELS){
    let Rw = 0, Cw = 0;
    if (isPair(L)){
      const a = hi(L);
      if (['A','K','Q','J','T','9','8','7'].includes(a)) Rw = 75*loosen;
      else if (['6','5'].includes(a)) Rw = 35*loosen;
      else if (['4','3','2'].includes(a)) Rw = 10*loosen;
    } else if (isSuited(L)){
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'8')) Rw = 70*loosen;
      else if (['K','Q','J'].includes(a) && atLeast(b,'T')) Rw = 55*loosen;
      else if (Math.abs(rIndex[a]-rIndex[b])===1 && atLeast(a,'9')) Rw = 45*loosen;
      else if (a==='A' && ['5','4','3','2'].includes(b)) Rw = 25*loosen;
      else Rw = 8*loosen;
    } else {
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'T')) Rw = 55*loosen;
      else if (a==='K' && atLeast(b,'J')) Rw = 40*loosen;
      else if (a==='Q' && atLeast(b,'J')) Rw = 25*loosen;
      else Rw = 0;
    }
    Rw *= raiseMul;
    Cw *= callMul;
    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

function gridVsOpen(hero: Pos, opener: Pos, stackBB:number, callers=0){
  const g = emptyGrid();
  const { raiseMul, callMul } = depthFactor(stackBB);
  const ip = seatScore(hero) > seatScore(opener);

  for (const L of LABELS){
    let Rw = 0, Cw = 0;

    if (isPair(L)){
      const a = hi(L);
      if (['A','K','Q'].includes(a)) { Rw = 70; Cw = ip?25:15; }
      else if (['J','T','9','8'].includes(a)) { Cw = ip? 55:35; Rw = 15; }
      else if (['7','6','5'].includes(a)) { Cw = ip? 40:20; Rw = 10; }
      else { Cw = ip? 25:10; }
    } else if (isSuited(L)){
      const a=hi(L), b=lo(L);
      if (a==='A'){
        if (b==='K') { Rw = 50; Cw = 45; }
        else if (['Q','J','T','9'].includes(b)) { Rw = 30; Cw = 55; }
        else if (['5','4','3','2'].includes(b)) { Rw = 15; Cw = 35; }
        else { Cw = 35; }
      } else if (['K','Q','J'].includes(a) && atLeast(b,'T')){
        Rw = 25; Cw = ip? 55:35;
      } else if (Math.abs(rIndex[a]-rIndex[b])===1 && atLeast(a,'9')){
        Cw = ip? 50:30; Rw = 10;
      } else {
        Cw = ip? 20:8;
      }
    } else {
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'Q')) { Rw = 45; Cw = 40; }
      else if (a==='K' && atLeast(b,'Q')) { Rw = 25; Cw = ip?35:20; }
      else if (a==='Q' && atLeast(b,'J')) { Cw = ip? 30:15; }
      else { /* fold mostly */ }
    }

    // callers tighten 3-bet bluffing a bit, and reduce flats OOP
    if (callers>0){
      Rw *= 0.9;
      if (!ip) Cw *= 0.8;
    }
    // SB flats are constrained
    if (hero==='SB' && !ip) { Cw *= 0.75; Rw *= 1.05; }

    Rw *= raiseMul; Cw *= callMul;
    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

function gridSqueeze(hero: Pos, opener: Pos, callers:number, stackBB:number){
  const g = emptyGrid();
  const { raiseMul, callMul } = depthFactor(stackBB);
  const ip = seatScore(hero) > seatScore(opener);
  for (const L of LABELS){
    let Rw=0, Cw=0;
    if (isPair(L)){
      const a=hi(L);
      if (['A','K','Q'].includes(a)) { Rw = 80; }
      else if (['J','T','9'].includes(a)) { Rw = 35; Cw = ip? 35:15; }
      else { Rw = 15; }
    } else if (isSuited(L)){
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'T')) { Rw = 45; Cw = 35; }
      else if (['K','Q'].includes(a) && atLeast(b,'T')) { Rw = 30; Cw = ip?30:15; }
      else if (Math.abs(rIndex[a]-rIndex[b])===1 && atLeast(a,'T')) { Rw = 20; }
    } else {
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'Q')) { Rw = 35; Cw = 30; }
      else if (a==='K' && atLeast(b,'J')) { Rw = 20; }
    }
    // more callers → narrower
    Rw *= (callers>=2? 0.75 : 0.9);
    Cw *= (ip? 1.0 : 0.8);

    Rw *= raiseMul; Cw *= callMul;
    g[L] = normalizeTo100(Rw,Cw);
  }
  return g;
}

// For “facing 3-bet / 4-bet” we still render Raise/Call/Fold,
// but tooltips will label Raise as 4-bet/5-bet respectively.
function gridFacing3bet(hero: Pos, opener: Pos, stackBB:number){
  const g = emptyGrid();
  const { raiseMul, callMul } = depthFactor(stackBB);
  for (const L of LABELS){
    let Rw=0, Cw=0;
    if (isPair(L)){
      const a = hi(L);
      if (['A','K','Q'].includes(a)) { Rw = 55; Cw = 35; }
      else if (['J','T','9','8'].includes(a)) { Cw = 45; }
      else { Cw = 25; }
    } else if (isSuited(L)){
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'J')) { Rw = 30; Cw = 45; }
      else if (['K','Q'].includes(a) && atLeast(b,'T')) { Rw = 20; Cw = 35; }
      else if (a==='A' && ['5','4','3','2'].includes(b)) { Rw = 10; }
    } else {
      const a=hi(L), b=lo(L);
      if (a==='A' && atLeast(b,'K')) { Rw = 35; Cw = 35; }
      else if (a==='K' && atLeast(b,'Q')) { Cw = 25; }
    }
    Rw *= raiseMul*0.9; Cw *= callMul;
    g[L] = normalizeTo100(Rw,Cw);
  }
  return g;
}

function makeGrid(node:ResolvedNode|null, stackBB:number){
  if (!node) return emptyGrid();
  switch(node.kind){
    case 'RFI': return gridRFI(node.hero, stackBB);
    case 'VS_OPEN': return gridVsOpen(node.hero!, node.opener!, stackBB, 0);
    case 'SQUEEZE': return gridSqueeze(node.hero!, node.opener!, node.callers||1, stackBB);
    case 'FACING_3BET': return gridFacing3bet(node.hero!, node.opener!, stackBB);
    // Basic fallbacks:
    case 'LIMP_TREE': return gridRFI(node.hero, stackBB);
    case 'BVB': return gridRFI(node.hero, stackBB);
    default: return gridRFI(node.hero, stackBB);
  }
}

/* ============================================================
   UI
   ============================================================ */

export default function Page(){
  const [input, setInput] = useState(
    'am on sb with as 4s of spades and villain in cutoff raises to 2.55 bb in a 1/3 cash game with 150 bb eff. i 3 bet to 11.5 bb and he calls.\nflop comes 4d 8s 2c. i bet 33% pot he calls. turn is 5h. i check  he bet 55% pot .i call river is 9h i check he bets 3/4  pot and i call. he showed 88.'
  );
  const [heroBox, setHeroBox] = useState('as 4s');
  const [villainBox, setVillainBox] = useState('Kc K');
  const [boardBox, setBoardBox] = useState('4d 8s 2c 5h 9h');

  const node = useMemo(()=>resolveNode(input), [input]);
  const stakesInline = useMemo(()=> (input.match(/\b(\d+(?:\.\d+)?)\s*[\/-]\s*(\d+(?:\.\d+)?)/)?.[0] || ''), [input]);
  const parsedBB = useMemo(()=> parseStackBB(input, stakesInline), [input, stakesInline]);

  // Stack state: auto from text if we have it, default 200 otherwise
  const [autoStack, setAutoStack] = useState(true);
  const [stackBB, setStackBB] = useState<number>(parsedBB ?? 200);
  useEffect(()=>{
    if (!autoStack) return;
    if (parsedBB && parsedBB !== stackBB) setStackBB(parsedBB);
  }, [parsedBB, autoStack, stackBB]);

  const havePositions = Boolean(node?.hero && (node?.opener || node?.kind==='RFI' || node?.kind==='BVB' || node?.kind==='LIMP_TREE'));
  const showStackHint = havePositions && !parsedBB;

  const grid = useMemo(()=> makeGrid(node, stackBB), [node, stackBB]);

  // little copy helper for the hint button
  function copy(text:string){ try{ navigator.clipboard?.writeText(text);}catch{} }

  // Count combos shown (non-pure-fold cells)
  const combosShown = useMemo(()=>{
    let cells = 0;
    for (const L of LABELS){
      const x = grid[L];
      if (x.raise>0 || x.call>0) cells++;
    }
    return cells;
  }, [grid]);

  // Tooltip label mapping for “facing 3b/4b” nodes (we keep R/C/F bars, but describe “Raise” as 4-bet etc.)
  const raiseWord = node?.kind==='FACING_3BET' ? '4-bet' :
                    node?.kind==='FACING_4BET' ? '5-bet' :
                    node?.kind==='SQUEEZE' ? 'Squeeze' :
                    node?.kind==='VS_OPEN' ? '3-bet' : 'Raise';

  return (
    <main className="page">
      <div className="container">
        <header className="brand">
          <h1>Only Poker</h1>
        </header>

        <section className="columns">
          {/* LEFT */}
          <div className="col left">
            <div className="card">
              <div className="cardTitle">Hand Played</div>
              <textarea
                className="textarea"
                value={input}
                onChange={(e)=>setInput(e.target.value)}
              />
              <div className="row gap">
                <button className="btn primary">Send</button>
                <button className="btn" onClick={()=>{ setInput(''); }}>Clear</button>
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Quick Card Assist (optional)</div>
              <div className="grid3">
                <input className="input" value={heroBox} onChange={e=>setHeroBox(e.target.value)} placeholder="Hero: Ah Qs" />
                <input className="input" value={villainBox} onChange={e=>setVillainBox(e.target.value)} placeholder="Villain (optional): Kc K" />
                <input className="input" value={boardBox} onChange={e=>setBoardBox(e.target.value)} placeholder="Board: Ks 7d 2c 9c 4h" />
              </div>
              <div className="muted">If parsing guesses wrong, correct the board here — the preview updates instantly.</div>
            </div>

            {/* Stack control + ambiguity hint */}
            <div className="row gap smallPad">
              <div className="stackBox">
                <label>Stack (bb)</label>
                <input
                  className="input small"
                  type="number" min={40} max={400} step={10}
                  value={stackBB}
                  onChange={(e)=>{ setStackBB(Number(e.target.value||200)); setAutoStack(false); }}
                />
                {parsedBB && parsedBB !== stackBB && (
                  <button className="p-btn" onClick={()=>{ setStackBB(parsedBB); setAutoStack(true); }} title={`Parsed from text: ${parsedBB}bb`}>
                    Use {parsedBB}bb
                  </button>
                )}
              </div>
            </div>

            {/* >>> NEW: small ambiguity hint bar shown ONLY when positions are known but stack is missing <<< */}
            {showStackHint && (
              <div className="hintBar" role="status" aria-live="polite">
                <span className="hintDot" aria-hidden>!</span>
                <span className="hintText">
                  Add the effective stack to <strong>Hand Played</strong> (e.g., <code>150bb eff.</code>) for an accurate preflop grid, then press <strong>Send</strong>.
                </span>
                <button className="hintBtn" onClick={()=>copy('150bb eff.')} title="Copy example" type="button">
                  Copy “150bb eff.”
                </button>
              </div>
            )}

            {/* Grid */}
            <div className="card">
              <div className="row spaceBetween">
                <div className="gridTitle">
                  Hero Decision Frequencies — {node?.opener ? `${node.hero} vs ${node.opener} open` : node?.kind==='RFI' ? `${node?.hero} (RFI)` : node?.kind==='BVB' ? 'Blind vs Blind' : 'Preflop'}
                  <span className="muted small"> ({combosShown} / 169 combos shown)</span>
                </div>
                <div className="legend">
                  <span className="chip raise">Raise</span>
                  <span className="chip call">Call</span>
                  <span className="chip fold">Fold</span>
                </div>
              </div>

              <div className="muted small" style={{marginBottom:8}}>Hover a cell to zoom; tooltip shows exact %</div>

              <div className="gridWrap">
                {/* Header row labels */}
                <div className="rowHead blank" />
                {RANKS.map((c)=>(<div key={'hdr'+c} className="colHead">{c}</div>))}
                {/* Matrix */}
                {RANKS.map((r,ri)=>(
                  <React.Fragment key={'r'+r}>
                    <div className="rowHead">{r}</div>
                    {RANKS.map((c,ci)=>{
                      const L = labelAt(ri,ci);
                      const x = grid[L];
                      const title = `${L} — ${raiseWord}: ${x.raise}%, Call: ${x.call}%, Fold: ${x.fold}%`;
                      return (
                        <div key={L} className="cell" title={title}>
                          <div className="bars">
                            <div className="bar raise" style={{width: `${x.raise}%`}} />
                            <div className="bar call"  style={{width: `${x.call}%`}} />
                            <div className="bar fold"  style={{width: `${x.fold}%`}} />
                          </div>
                          <div className="lbl">{L}</div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT – keep your existing boxes (cards/date/stakes/board/GTO/etc.) minimal here */}
          <div className="col right">
            <div className="card">
              <div className="cardTitle">Board</div>
              <div className="muted">Flop: {boardBox.split(/\s+/).slice(0,3).join(' ')} &nbsp;&nbsp; Turn: {boardBox.split(/\s+/)[3]||'—'} &nbsp;&nbsp; River: {boardBox.split(/\s+/)[4]||'—'}</div>
            </div>

            <div className="card">
              <div className="cardTitle">GTO Strategy (detailed)</div>
              <textarea className="textarea mono" rows={8} placeholder="Preflop/Flop/Turn/River plan… (filled by your analyze-hand route)">
{`Preflop: 3-bet or call as shown in the grid; prefer suited Ax and high pairs at 150bb.
Flop/Turn/River: (kept from your analyze endpoint).`}
              </textarea>
            </div>

            <div className="card">
              <div className="cardTitle">Exploitative Deviations</div>
              <ul className="bullets">
                <li>Pool tends to overfold vs larger sizes OOP → consider 60–70% pot with value, trim pure air.</li>
                <li>At 150bb, suited wheel Aces make good pressure candidates vs CO.</li>
              </ul>
              <div className="row end gapTop">
                <button className="btn">Analyze Again</button>
                <button className="btn primary">Confirm &amp; Save to Notion</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Styles */}
      <style jsx global>{`
        :root{
          --bg:#f6f7fb; --panel:#ffffff; --line:#e6e8ef; --muted:#657084; --text:#0d1020;
          --raise:#ef8a5a; --call:#4b78ff; --fold:#2a2f3a;
          --primary:#3366ff; --primary2:#2252db;
          --hintA:#fffbea; --hintB:#fff4cf; --hintBorder:#eab308;
        }
        *{ box-sizing:border-box; }
        html,body{ margin:0; padding:0; background:var(--bg); color:var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .page{ min-height:100vh; padding:22px; }
        .container{ max-width:1200px; margin:0 auto; }
        .brand{ display:flex; justify-content:center; margin-bottom:16px; }
        .brand h1{ margin:0; font-size:30px; letter-spacing:.3px; }

        .columns{ display:grid; grid-template-columns: 1.1fr .9fr; gap:24px; }
        @media (max-width: 1100px){ .columns{ grid-template-columns:1fr; } }

        .card{ background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:14px; box-shadow:0 8px 26px rgba(13,16,32,.07); margin-bottom:16px; }
        .cardTitle{ font-weight:700; color:#0f1b3d; margin-bottom:10px; }
        .textarea{ width:100%; min-height:160px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#fbfcff; }
        .textarea.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; line-height:1.45; }

        .row{ display:flex; align-items:center; }
        .gap{ gap:12px; } .gapTop{ margin-top:10px; }
        .spaceBetween{ justify-content:space-between; }
        .end{ justify-content:flex-end; }

        .grid3{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; }
        @media (max-width: 720px){ .grid3{ grid-template-columns:1fr; } }

        .input{ width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:#fbfcff; }
        .input.small{ width:120px; }

        .btn{ appearance:none; border:1px solid var(--line); background:#eef2ff; color:#0f1b3d; padding:9px 14px; border-radius:10px; cursor:pointer; }
        .btn:hover{ background:#e6ecff; }
        .btn.primary{ background:linear-gradient(180deg, var(--primary), var(--primary2)); color:white; border-color:#2b4fd6; box-shadow:0 8px 22px rgba(51,102,255,.25); }
        .btn.primary:hover{ filter:brightness(1.05); }

        .muted{ color:var(--muted); font-size:13px; }
        .muted.small{ font-size:12.5px; }
        .smallPad{ margin:6px 0 2px; }

        .stackBox{ display:flex; align-items:center; gap:10px; }
        .p-btn{ border:1px solid #c8d0ff; background:#f7f9ff; color:#2743b8; padding:6px 10px; border-radius:8px; cursor:pointer; }
        .p-btn:hover{ background:#eef3ff; }

        /* Hint bar (NEW) */
        .hintBar{
          display:flex; align-items:center; gap:10px;
          margin:8px 0 12px; padding:8px 10px;
          border:1px solid rgba(234,179,8,.25);
          background: linear-gradient(180deg, var(--hintA), var(--hintB));
          color:#4b3d09; border-radius:10px;
          box-shadow: 0 6px 18px rgba(234,179,8,.18);
          font-size: 13.5px;
        }
        .hintDot{
          display:inline-flex; align-items:center; justify-content:center;
          width:18px; height:18px; border-radius:999px;
          background:#f59e0b; color:white; font-weight:800; font-size:12px;
          box-shadow: 0 2px 8px rgba(245,158,11,.35);
        }
        .hintText code{ background:#fff; padding:1px 5px; border-radius:6px; border:1px solid rgba(0,0,0,.06); }
        .hintBtn{
          margin-left:auto; border:1px solid rgba(234,179,8,.45);
          background:#fff; color:#8a6a00; padding:6px 10px; border-radius:8px;
          cursor:pointer; font-weight:600;
        }
        .hintBtn:hover{ background:#fff7d1; }

        /* Grid */
        .gridTitle{ font-weight:700; }
        .legend .chip{ display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; font-size:12px; margin-left:6px; background:#eef2ff; border:1px solid var(--line); }
        .legend .chip.raise{ background:#ffe8dc; border-color:#ffd0bb; }
        .legend .chip.call{ background:#e6eeff; border-color:#cddcff; }
        .legend .chip.fold{ background:#e8eaf0; border-color:#d8dce4; }

        .gridWrap{
          display:grid;
          grid-template-columns: 28px repeat(13, minmax(46px,1fr));
          gap:6px;
          user-select:none;
        }
        .rowHead, .colHead{ font-weight:700; color:#223; font-size:13px; text-align:center; padding-top:4px; }
        .rowHead.blank{ visibility:hidden; }
        .cell{
          position:relative; height:38px; border-radius:10px; overflow:hidden;
          background:#1d232d; border:1px solid #2c3340;
          transform-origin:center; transition:transform .08s ease, box-shadow .12s ease;
        }
        .cell:hover{ transform:scale(1.06); box-shadow:0 10px 24px rgba(0,0,0,.18); z-index:2; }
        .bars{ position:absolute; inset:0; display:flex; }
        .bar{ height:100%; }
        .bar.raise{ background: #ef8a5a; }
        .bar.call { background: #4b78ff; }
        .bar.fold { background: #2a2f3a; flex:1; }
        .lbl{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; text-shadow:0 1px 2px rgba(0,0,0,.45); font-size:12px; }
      `}</style>
    </main>
  );
}
