import { createClient } from '@/lib/supabase/client';

export async function saveToSupabase(payload: {
  hand_date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
}) {
  const supabase = createClient();

  // (optional) require auth on the client
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('hands')
    .insert([{ user_id: user.id, ...payload }]);

  if (error) throw error;
}
