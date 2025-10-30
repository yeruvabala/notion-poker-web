export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createServerClient } from '@/lib/supabase/server';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;
const s3 = new S3Client({ region: REGION });

function safeName(name: string) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: Request) {
  try {
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const contentType = file.type || 'text/plain';
    const arrayBuf = await file.arrayBuffer();
    const body = Buffer.from(arrayBuf);
    const key = `${user.id}/${Date.now()}_${safeName(file.name)}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return NextResponse.json({ key, contentType });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'direct upload failed' }, { status: 500 });
  }
}
