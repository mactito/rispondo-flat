import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { userId, email } = await req.json();

  // Check if tenant exists
  const { data: existing } = await supabaseAdmin
   .from('tenants')
   .select('*')
   .eq('owner_id', userId)
   .single();

  if (existing) return Response.json(existing);

  // Create new one
  const { data, error } = await supabaseAdmin
   .from('tenants')
   .insert({ owner_id: userId, name: email.split('@')[0] })
   .select()
   .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}