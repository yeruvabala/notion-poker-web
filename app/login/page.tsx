// app/login/page.tsx
import { Suspense } from 'react';
import LoginClient from './LoginClient';

// Avoid static export/prerender for this page
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
