import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { userId, email, name } = await req.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Find or create tenant
    let { data: tenant } = await supabaseAdmin.from('tenants').select('id').eq('owner_id', userId).maybeSingle();

    if (!tenant) {
      const { data: newTenant, error } = await supabaseAdmin
      .from('tenants')
      .insert({ owner_id: userId, business_name: name || email.split('@')[0], email })
      .select('id')
      .single();
      if (error) throw error;
      tenant = newTenant;
    }

    // 2. Create / update profile -> THIS WAS MISSING
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenant.id,
      email: email
    }, { onConflict: 'id' });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, tenantId: tenant.id });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}