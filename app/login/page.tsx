// app/login/page.tsx
import { Suspense } from "react";
import SuitsRow from "@/components/SuitsRow";   // <- from the file I gave you
import LoginClient from "./LoginClient";       // <- your existing client form

// keep build-time caching predictable for auth pages
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="min-h-screen w-full bg-[#f7f9fb] flex flex-col items-center justify-center px-4 py-10">
      {/* Suits row (perfectly symmetric SVG icons, pure black) */}
      <SuitsRow size={64} gap={28} className="text-black mb-8" />

      {/* Your login card */}
      <div className="w-full max-w-5xl">
        <Suspense fallback={null}>
          <LoginClient />
        </Suspense>
      </div>
    </div>
  );
}
