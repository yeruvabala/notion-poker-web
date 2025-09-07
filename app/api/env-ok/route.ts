// app/api/env-ok/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    notionTokenPresent: Boolean(process.env.NOTION_TOKEN?.startsWith("secret_")),
    notionDbIdPresent: Boolean(process.env.NOTION_DATABASE_ID),
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  });
}
