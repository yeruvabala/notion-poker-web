// app/(app)/layout.tsx
// TEMP: no server-side redirect while we stabilize login
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {children}
    </div>
  );
}
