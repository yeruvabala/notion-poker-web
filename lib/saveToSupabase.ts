// lib/saveToSupabase.ts
import { createClient } from '@/lib/supabase/client';

export type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  hand_class?: string | null;
  source_used?: 'SUMMARY' | 'STORY' | null;
};

/**
 * Inserts a hand into the `hands` table for the current user.
 * Throws on error. Returns void on success.
 */
export async function saveHandToSupabase(fields: Fields, notes?: string | null) {
  const supabase = createClient();
  if (!supabase) {
    throw new Error('Supabase env vars are missing. See /api/env-ok.');
  }

  // Narrow for TypeScript – we know it isn't null after the guard above
  const sb = supabase as NonNullable<typeof supabase>;

  // Ensure the user is signed in
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) throw new Error('Not signed in');

  // Build row with nulls (not undefined) so Postgres accepts them
  const row = {
    user_id: user.id,
    date: fields.date ?? null,
    stakes: fields.stakes ?? null,
    position: fields.position ?? null,
    cards: fields.cards ?? null,
    board: fields.board ?? null,
    gto_strategy: fields.gto_strategy ?? null,
    exploit_deviation: fields.exploit_deviation ?? null,
    learning_tag: fields.learning_tag ?? [],
    hand_class: fields.hand_class ?? null,
    source_used: fields.source_used ?? null,
    notes: notes ?? null,
  };

  const { error } = await sb.from('hands').insert(row);
  if (error) throw error;
}
