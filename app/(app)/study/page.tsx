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

    setBusy(true);
    setMsg(null);

    try {
      // 1) ensure user is logged in
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw new Error(`Supabase getUser error: ${uerr.message}`);
      if (!user) throw new Error('Please sign in');

      // 2) choose content type and ask server to presign for THIS type
      const contentType = file.type || 'text/plain';

      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType }),
      });

      const pj = await presignRes.json();
      if (!presignRes.ok) throw new Error(pj?.error || `presign ${presignRes.status}`);
      const { url, key } = pj as { url: string; key: string };
      if (!url || !key) throw new Error('presign returned no url/key');

      // 3) PUT to S3 using the SAME content type
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);

      // 4) enqueue a row in hand_files
      const s3Path = `s3://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}/${key}`;
      const enqueue = await fetch('/api/hand-files/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: s3Path,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: contentType,
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
