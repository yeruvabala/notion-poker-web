// app/api/uploads/presign/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerClient } from '@/lib/supabase/server';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

// Node runtime client (Edge won’t work with AWS SDK here)
const s3 = new S3Client({ region: REGION });

export async function POST(req: Request) {
  try {
    console.log('[presign] start');

    // ✅ Auth: must be logged in
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.log('[presign] user ok:', user.id);

    // ✅ Env guard (this is the bit you asked about)
    if (!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json(
        { error: 'Server missing AWS_REGION/AWS_S3_BUCKET' },
        { status: 500 }
      );
    }

    // ✅ Read filename from body
    const { filename } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });
    console.log('[presign] filename:', filename);

    // ✅ Safe S3 object key
    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${user.id}/${Date.now()}_${safe}`;
    console.log('[presign] key:', key, 'bucket:', BUCKET, 'region:', REGION);

    // ✅ Create presigned PUT URL
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'text/plain',
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 }); // 15 min
    console.log('[presign] signed url ok');

    return NextResponse.json({ url, key });
  } catch (e: any) {
    console.error('[presign] error:', e?.message);
    return NextResponse.json({ error: e?.message || 'presign failed' }, { status: 500 });
  }
}
