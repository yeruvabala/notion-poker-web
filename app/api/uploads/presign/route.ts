export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerClient } from '@/lib/supabase/server';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

export async function POST(req: Request) {
  try {
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { filename, contentType } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });
    if (!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json({ error: 'Server missing AWS_REGION/AWS_S3_BUCKET' }, { status: 500 });
    }

    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${user.id}/${Date.now()}_${safe}`;

    // Create a fresh S3 client and DISABLE the flexible checksums middleware
    const s3 = new S3Client({ region: REGION });
    // This prevents x-amz-sdk-checksum-algorithm / x-amz-checksum-* from being added to the URL
    s3.middlewareStack.remove('flexibleChecksumsMiddleware' as any);

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'text/plain',
      // DO NOT set any Checksum* fields here
    });

    // Also ensure we don't sign any checksum headers just in case
    const url = await getSignedUrl(s3, cmd, {
      expiresIn: 15 * 60,
      unsignableHeaders: new Set([
        'x-amz-checksum-crc32',
        'x-amz-checksum-crc32c',
        'x-amz-checksum-sha1',
        'x-amz-checksum-sha256',
        'x-amz-sdk-checksum-algorithm',
      ]),
    });

    return NextResponse.json({ url, key });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'presign failed' }, { status: 500 });
  }
}
