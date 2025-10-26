import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

// The server has AWS creds via env or IAM role (no creds in browser)
const s3 = new S3Client({ region: REGION });

export async function POST(req: Request) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { filename } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

    const key = `${user.id}/${Date.now()}_${filename}`; // user-scoped prefix
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'text/plain', // most HH are txt; browser will still set correct type on PUT
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 }); // 15 min

    return NextResponse.json({ url, key });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'presign failed' }, { status: 500 });
  }
}
