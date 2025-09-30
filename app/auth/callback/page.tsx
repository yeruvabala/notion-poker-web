'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import CallbackInner from './ui/CallbackInner';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p>Completing sign-in…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
