export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const body = await req.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing supabase env' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Accept both old and new field names
    const dataToInsert = {
      tenant_id: body.tenant_id,
      from_number: body.from_number || body.customer_phone || null,
      caller_name: body.caller_name || body.customer_name || null,
      service_booked: body.service_booked || body.service_name || null,
      booking_time: body.booking_time || new Date().toISOString(),
      status: body.status || 'booked',
      customer_name: body.customer_name || body.caller_name || null,
      customer_phone: body.customer_phone || body.from_number || null,
      service_name: body.service_name || body.service_booked || null,
    };

    if (!dataToInsert.tenant_id) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calls')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('BOOK API ERROR', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}