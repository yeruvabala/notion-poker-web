'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Page() {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true); setMsg(null);
    try {
      // 1) who is logged in?
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr || !user) throw new Error('Please sign in');

      // 2) ask server for a pre-signed S3 URL + key
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });
      const { url, key } = await presignRes.json();
      if (!presignRes.ok) throw new Error(url || 'Failed to presign');

      // 3) upload file directly to S3 with the pre-signed URL
      const put = await fetch(url, { method: 'PUT', body: file });
      if (!put.ok) throw new Error('Upload to S3 failed');

      // 4) enqueue a job in hand_files (S3 path)
      const s3Path = `s3://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}/${key}`;
      const enqueue = await fetch('/api/hand-files/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: s3Path,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || 'text/plain',
        }),
      });
      const ej = await enqueue.json();
      if (!enqueue.ok || !ej?.ok) throw new Error(ej?.error || 'Enqueue failed');

      setMsg('Uploaded & queued ✓  The robot will parse it soon.');
      e.target.value = '';
    } catch (err: any) {
      setMsg(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-slate-700" style={{ padding: 20 }}>
      <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Study</h2>
      <p style={{ color: '#6b7280', marginBottom: 12 }}>
        Upload a hand history (.txt). We’ll queue it for parsing and analysis.
      </p>
      <input type="file" onChange={onPick} disabled={busy} />
      {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
