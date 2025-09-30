// app/api/env-ok/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    // --- Supabase (required) ---
    supabaseUrlPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")),
    supabaseAnonKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    // If you use server-side DB writes (optional, but nice to verify)
    supabaseServiceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),

    // --- OpenAI (your analyze-hand route uses this) ---
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),

    // --- Notion (set to false or remove if you’re done with Notion) ---
    notionTokenPresent: Boolean(process.env.NOTION_TOKEN?.startsWith("secret_")),
    notionDbIdPresent: Boolean(process.env.NOTION_DATABASE_ID),

    // (Optional) If you keep a public site URL env for auth redirects/emails
    siteUrlPresent: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  });
}
