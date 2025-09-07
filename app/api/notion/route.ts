import { NextResponse } from "next/server";
import { saveToNotion, ParsedFields } from "@/lib/notion";

export async function POST(req: Request) {
  const body = await req.json();
  const fields: ParsedFields = body?.fields;
  if (!fields) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const dbId = process.env.NOTION_DATABASE_ID!;
  if (!dbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID" }, { status: 500 });

  try {
    const page = await saveToNotion(dbId, fields);
    return NextResponse.json({ ok: true, pageId: (page as any).id, url: (page as any).url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save" }, { status: 500 });
  }
}