export const metadata = {
  title: 'Notion Poker Ingest',
  description: 'Paste text → AI parses → Review → Save to Notion',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#f9fafb', color: '#111827' }}>{children}</body>
    </html>
  );
}
