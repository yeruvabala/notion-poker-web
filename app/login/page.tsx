// app/login/page.tsx
import { Suspense } from 'react';
import LoginClient from './LoginClient';

// important to avoid the “missing suspense” warning in prod
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
