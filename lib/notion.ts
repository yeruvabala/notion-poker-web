// lib/notion.ts
import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export type ParsedFields = {
  date?: string | null;
  stakes?: string | null;               // <-- text now
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;       // <-- correct spelling
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
};

export async function saveToNotion(dbId: string, f: ParsedFields) {
  const props: any = {
    "Date": f.date ? { date: { start: f.date } } : { date: null },
    // NOTE: change your Notion property "Stakes" to type "Rich text"
    "Stakes": { rich_text: [{ type: "text", text: { content: String(f.stakes ?? "") } }] },
    "Position": f.position ? { select: { name: f.position } } : { select: null },
    "Cards": { rich_text: [{ type: "text", text: { content: f.cards ?? "" } }] },
    "Villain Action": { rich_text: [{ type: "text", text: { content: f.villain_action ?? "" } }] },
    "GTO Strategy": { rich_text: [{ type: "text", text: { content: f.gto_strategy ?? "" } }] },
    "Exploit Deviation": { rich_text: [{ type: "text", text: { content: f.exploit_deviation ?? "" } }] },
    "Learning Tag": { multi_select: (f.learning_tag ?? []).map((name) => ({ name })) },
  };

  return notion.pages.create({
    parent: { database_id: dbId },
    properties: props,
  });
}
