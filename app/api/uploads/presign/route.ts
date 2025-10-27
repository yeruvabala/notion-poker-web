export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerClient } from '@/lib/supabase/server';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;
const s3 = new S3Client({ region: REGION });

export async function POST(req: Request) {
  try {
    // Auth
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Read inputs
    const { filename, contentType } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

    if (!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json(
        { error: 'Server missing AWS_REGION/AWS_S3_BUCKET' },
        { status: 500 }
      );
    }

    // Build safe S3 key
    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${user.id}/${Date.now()}_${safe}`;

    // Presign PUT with matching ContentType
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'text/plain',
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });
    return NextResponse.json({ url, key });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'presign failed' }, { status: 500 });
  }
}
