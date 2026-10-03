import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { userId, email, name } = await req.json();
    console.log("API /api/signup called:", { userId, email, name });

    if (!userId ||!email) {
      return NextResponse.json({ error: 'userId e email richiesti' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if tenant already exists
    const { data: existing } = await supabaseAdmin
     .from('tenants')
     .select('id')
     .eq('owner_id', userId)
     .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, tenantId: existing.id, message: 'Tenant già esiste' });
    }

    // Create tenant - use business_name, not name (your table doesn't have name column)
    const { data, error } = await supabaseAdmin
     .from('tenants')
     .insert({
        owner_id: userId,
        business_name: name || email.split('@')[0],
        email: email
      })
     .select()
     .single();

    if (error) {
      console.error("Insert tenant error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, tenantId: data.id });

  } catch (err) {
    console.error("API signup catch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}