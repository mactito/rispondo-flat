export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const body = await req.json();
    console.log('VAPI IN:', JSON.stringify(body).substring(0,2000));

    // VAPI can send in 2 formats
    const message = body.message || body;
    const func = message.functionCall || message.toolCalls?.[0] || body.functionCall;
    const toolCallId = message.toolCallId || message.toolCalls?.[0]?.id || body.toolCallId || 'call_123';

    if (!func) {
      console.log('No function call, returning ok');
      return NextResponse.json({});
    }

    const { name, parameters, arguments: args } = func;
    const params = parameters || (typeof args === 'string'? JSON.parse(args) : args) || {};

    console.log(`Function: ${name}`, params);

    if (name === 'check_availability') {
      const tenant_id = params.tenant_id;
      const datetime = params.datetime;
      const duration = params.duration || 30;

      if (!tenant_id ||!datetime) {
        return NextResponse.json({
          results: [{ toolCallId, result: JSON.stringify({ available:false, reason:'Manca tenant o data' }) }]
        });
      }

      const start = new Date(datetime);
      const end = new Date(start.getTime() + duration*60000);

      const { data: existing } = await supabase
       .from('appointments')
       .select('id')
       .eq('tenant_id', tenant_id)
       .gte('start_time', start.toISOString())
       .lt('start_time', end.toISOString())
       .neq('status','cancelled');

      const available =!existing || existing.length === 0;

      const result = { available, reason: available? 'Slot libero' : 'Slot occupato', start: start.toISOString() };
      console.log('Check result:', result);

      return NextResponse.json({
        results: [{ toolCallId, result: JSON.stringify(result) }]
      });
    }

    if (name === 'book_appointment') {
      const { tenant_id, customer_name, customer_phone, service, datetime, source } = params;

      const start = new Date(datetime);
      const end = new Date(start.getTime() + 30*60000);

      const { data, error } = await supabase.from('appointments').insert({
        tenant_id,
        customer_name: customer_name || 'Cliente',
        customer_phone: customer_phone || '',
        service: service || 'Taglio',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
        source: source || 'ai-auto'
      }).select().single();

      if (error) {
        console.error('Insert error:', error);
        return NextResponse.json({
          results: [{ toolCallId, result: JSON.stringify({ success:false, error:error.message }) }]
        });
      }

      console.log('Booked:', data.id);
      return NextResponse.json({
        results: [{ toolCallId, result: JSON.stringify({ success:true, id:data.id, message:'Prenotazione confermata' }) }]
      });
    }

    return NextResponse.json({ results: [{ toolCallId, result: JSON.stringify({ error:'Funzione non trovata' }) }] });

  } catch (e) {
    console.error('WEBHOOK ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 200 }); // return 200 so VAPI doesn't hang
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'webhook alive' });
}