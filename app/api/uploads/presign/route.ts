export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerClient } from '@/lib/supabase/server'; // ← change

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;
const s3 = new S3Client({ region: REGION });

export async function POST(req: Request) {
  try {
    const sb = createServerClient(); // ← change
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { filename } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${user.id}/${Date.now()}_${safe}`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'text/plain',
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });
    return NextResponse.json({ url, key });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'presign failed' }, { status: 500 });
  }
}
