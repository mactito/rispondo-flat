import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { tenant_id } = await req.json();
  
  const { error } = await supabase
    .from('tenants')
    .update({ 
      google_refresh_token: null, 
      calendar_id: null,
      google_access_token: null 
    })
    .eq('id', tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}