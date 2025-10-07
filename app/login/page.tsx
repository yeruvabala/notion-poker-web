import { Suspense } from 'react';
import SuitRow from './SuitRow';
import LoginClient from './LoginClient'; // your existing client component

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-5xl">
        {/* Suits row */}
        <SuitRow />

        {/* Your existing card */}
        <Suspense fallback={null}>
          <LoginClient />
        </Suspense>
      </div>
    </div>
  );
}
