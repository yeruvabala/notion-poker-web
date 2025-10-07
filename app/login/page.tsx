"use client";

import { Suspense } from 'react';
import LoginClient from './LoginClient';

// keep Next from trying to prerender a static version
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <main className="wrap">
        <section className="card">
          <aside className="brandPane">
            <div className="brand">
              <h1>Only Poker</h1>
              <p className="sub">v0.1 · preview</p>
            </div>
          </aside>

          <div className="formPane">
            <LoginClient />
          </div>
        </section>
      </main>

      <style jsx>{`
        :root {
          --ink: #0f172a;
          --muted: #6b7280;
          --panel: #ffffff;
          --ring: rgba(2, 6, 23, 0.08);
          --shadow: 0 30px 60px rgba(2, 6, 23, 0.10),
                    0 10px 25px rgba(2, 6, 23, 0.06);
        }
        .wrap {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: #f6f8fb;
          padding: 32px;
        }
        .card {
          width: min(960px, 92vw);
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          background: var(--panel);
          border-radius: 16px;
          box-shadow: var(--shadow);
          overflow: hidden;
          border: 1px solid rgba(2, 6, 23, 0.06);
        }
        .brandPane {
          background:
            radial-gradient(1200px 400px at -10% -30%, #eef2ff 0%, #ffffff 55%),
            linear-gradient(180deg, #fafbff 0%, #ffffff 100%);
          padding: 56px 56px 72px;
          display: grid;
          align-content: end;
        }
        .brand h1 {
          margin: 0 0 8px 0;
          font-size: clamp(26px, 3.8vw, 42px);
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--ink);
          font-weight: 800;
        }
        .sub {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }
        .formPane {
          padding: 40px 40px 44px;
          display: grid;
          align-content: start;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .card { grid-template-columns: 1fr; }
          .brandPane { padding: 28px 24px; align-content: start; }
          .formPane { padding: 24px; }
        }
      `}</style>
    </Suspense>
  );
}
