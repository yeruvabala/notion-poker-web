'use client';

import React, { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Page() {
  // avoid “Multiple GoTrueClient instances” warning
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setMsg(null);

    try {
      // 1) ensure user is logged in
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw new Error(`Supabase getUser error: ${uerr.message}`);
      if (!user) throw new Error('Please sign in');

      // 2) Direct upload to our API (server will put to S3)
      const fd = new FormData();
      fd.append('file', file);

      const up = await fetch('/api/uploads/direct', { method: 'POST', body: fd });
      const uj = await up.json();
      if (!up.ok) throw new Error(uj?.error || `direct upload ${up.status}`);

      const { key, contentType } = uj as { key: string; contentType: string };

      // 3) Enqueue a row in hand_files
      const s3Path = `s3://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}/${key}`;
      const enqueue = await fetch('/api/hand-files/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: s3Path,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: contentType || file.type || 'text/plain',
        }),
      });
      const ej = await enqueue.json().catch(() => ({}));
      if (!enqueue.ok || !ej?.ok) throw new Error(`Enqueue failed: ${ej?.error || enqueue.status}`);

      setMsg('Uploaded & queued ✓  The robot will parse it soon.');
      e.target.value = '';
    } catch (err: any) {
      setMsg(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-slate-700" style={{ padding: 24 }}>
      <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 12 }}>Study</h2>
      <p style={{ color: '#6b7280', marginBottom: 12 }}>
        Upload a hand history (.txt). We’ll queue it for parsing and analysis.
      </p>
      <input type="file" onChange={onPick} disabled={busy} />
      {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
