// lib/saveToSupabase.ts
import { createClient } from '@/lib/supabase/client'
import type { ParsedFields } from '@/lib/types'

export async function saveToSupabase(f: ParsedFields) {
  const supabase = createClient()

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Not signed in')

  const payload = {
    user_id: user.id,
    hand_date: f.date ?? null,
    stakes: f.stakes ?? null,
    position: f.position ?? null,
    cards: f.cards ?? null,
    villain_action: f.villain_action ?? null,
    gto_strategy: f.gto_strategy ?? null,
    exploit_deviation: f.exploit_deviation ?? null,
    learning_tags: f.learning_tag ?? [],
  }

  const { data, error } = await supabase
    .from('poker_entries')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}
