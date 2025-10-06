'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg('Password updated. Redirecting to login…');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (e: any) {
      setErr(e?.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#0b0e14',color:'#e5e7eb'}}>
      <form onSubmit={submit} style={{width:360,background:'#111827',padding:24,borderRadius:16,border:'1px solid #1f2937'}}>
        <h2 style={{marginTop:0}}>Set a new password</h2>
        <label style={{fontSize:13,color:'#9ca3af'}}>New password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #374151',background:'#0f1220',color:'#e5e7eb'}}
        />
        <button disabled={busy} style={{width:'100%',marginTop:12,padding:'12px 14px',borderRadius:12,border:'1px solid #facc15',background:'linear-gradient(180deg,#facc15,#eab308)',color:'#0b0e14',fontWeight:900}}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
        {err && <div style={{marginTop:10,background:'#7f1d1d',padding:10,borderRadius:10}}> {err} </div>}
        {msg && <div style={{marginTop:10,background:'#064e3b',padding:10,borderRadius:10}}> {msg} </div>}
      </form>
    </main>
  );
}
