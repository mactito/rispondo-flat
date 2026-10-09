export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function parseItalianDate(input) {
  if (!input) return null;
  // already ISO?
  if (input.includes('T') &&!isNaN(new Date(input).getTime())) {
    return new Date(input);
  }
  let d = new Date();
  d.setSeconds(0,0);
  const lower = input.toLowerCase();
  if (lower.includes('dopodomani')) d.setDate(d.getDate()+2);
  else if (lower.includes('domani')) d.setDate(d.getDate()+1);
  else {
    const days = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
    for (let i=0;i<days.length;i++) {
      if (lower.includes(days[i])) {
        let diff = i - d.getDay();
        if (diff <=0) diff+=7;
        d.setDate(d.getDate()+diff);
        break;
      }
    }
  }
  const m1 = lower.match(/alle\s*(\d{1,2})(?:[:\.](\d{2}))?/);
  if (m1) d.setHours(parseInt(m1[1]), parseInt(m1[2]||0),0,0);
  else if (lower.match(/(\d{1,2}):(\d{2})/)) {
    const m2 = lower.match(/(\d{1,2}):(\d{2})/);
    d.setHours(parseInt(m2[1]), parseInt(m2[2]),0,0);
  }
  if (lower.includes('mezza')) d.setMinutes(30);
  return d;
}

export async function POST(req) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const body = await req.json();
    console.log('VAPI IN:', JSON.stringify(body).substring(0,2000));

    const message = body.message || body;
    const func = message.functionCall || message.toolCalls?.[0] || message.tool_calls?.[0] || body.functionCall;
    const toolCallId = message.toolCallId || func?.id || body.toolCallId || message.toolCalls?.[0]?.id || 'call_123';

    if (!func) return NextResponse.json({});

    const { name, parameters, arguments: argsRaw } = func;
    let params = parameters || {};
    if (argsRaw) {
      params = typeof argsRaw === 'string'? JSON.parse(argsRaw) : argsRaw;
    }
    // sometimes params nested in function.arguments
    if (func.function?.arguments) {
      const nested = typeof func.function.arguments === 'string'? JSON.parse(func.function.arguments) : func.function.arguments;
      params = {...params,...nested };
    }

    const fnName = name || func.function?.name || func.name;
    console.log(`Function: ${fnName}`, params);

    // TRAINING: parse Italian date if AI sent "domani alle 10"
    let dtRaw = params.datetime || params.data || params.date;
    let dt = parseItalianDate(dtRaw);
    if (!dt || isNaN(dt.getTime())) dt = new Date(dtRaw);

    if (fnName === 'check_availability') {
      const tenant_id = params.tenant_id;
      const duration = params.duration || 30;

      if (!tenant_id ||!dtRaw) {
        return NextResponse.json({
          results: [{ toolCallId, result: JSON.stringify({ available:false, reason:'Manca data' }) }]
        });
      }

      const start = dt;
      const end = new Date(start.getTime() + duration*60000);

      const { data: existing } = await supabase
       .from('appointments')
       .select('id')
       .eq('tenant_id', tenant_id)
       .gte('start_time', new Date(start.getTime() - 60*60000).toISOString())
       .lte('start_time', new Date(start.getTime() + 60*60000).toISOString())
       .neq('status','cancelled');

      const available =!existing || existing.length === 0;
      const result = {
        available,
        reason: available? 'Slot libero' : 'Slot occupato, proponi alternativa',
        start: start.toISOString(),
        end: end.toISOString(),
        alternatives:!available? [
          new Date(start.getTime()+60*60000).toISOString(),
          new Date(start.getTime()+90*60000).toISOString()
        ] : []
      };

      return NextResponse.json({
        results: [{ toolCallId, result: JSON.stringify(result) }]
      });
    }

    if (fnName === 'book_appointment') {
      const tenant_id = params.tenant_id;
      const start = dt;
      const end = new Date(start.getTime() + 30*60000);

      const { data, error } = await supabase.from('appointments').insert({
        tenant_id,
        customer_name: params.customer_name || 'Cliente',
        customer_phone: params.customer_phone || '',
        service: params.service || 'Taglio',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
        source: params.source || 'ai-auto'
      }).select().single();

      if (error) {
        return NextResponse.json({
          results: [{ toolCallId, result: JSON.stringify({ success:false, error:error.message }) }]
        });
      }

      return NextResponse.json({
        results: [{ toolCallId, result: JSON.stringify({ success:true, id:data.id, message:'Prenotazione confermata per '+start.toLocaleString('it-IT') }) }]
      });
    }

    return NextResponse.json({ results: [{ toolCallId, result: JSON.stringify({ error:'Funzione non trovata' }) }] });

  } catch (e) {
    console.error('WEBHOOK ERROR:', e);
    return NextResponse.json({ results: [{ toolCallId: 'call_123', result: JSON.stringify({ available:false, reason:'Errore: '+e.message }) }] }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'webhook alive' });
}