export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const WEBHOOK_URL = 'https://rispondo-flat-g7ns.vercel.app/api/vapi/webhook';

function getSystemPrompt(tenant, knowledge) {
  const services = (tenant.services || []).map(s => s.name).join(', ') || 'Tavolo';
  const isRisto = tenant.category === 'ristorante';
  const businessName = tenant.business_name || 'il nostro locale';
  const city = tenant.city || '';
  const openingHours = JSON.stringify(tenant.opening_hours || {});

  const knowledgeText = knowledge ? `\nINFO EXTRA DEL TITOLARE (USA QUESTE INFO PER RISPONDERE): ${knowledge}\n` : '';

  if (isRisto) {
    return `
Sei l'assistente vocale di ${businessName}, ristorante a ${city}.
${knowledgeText}
=== MODALITA' RISTORANTE - SEI UN RISTORANTE ===
Tu OFFRI servizi di ristorazione: ${services}. MAI dire "non offriamo ristorazione".

ORARI: ${openingHours}
Se l'utente chiede orario, rispondi con questi orari.

OBIETTIVO: Prenotare un tavolo.

FLUSSO OBBLIGATORIO:
1. Chiedi: "Per quante persone?"
2. Chiedi: "Per quando? Giorno e ora?"
3. Chiedi: "A nome di chi? E un recapito telefonico?"
4. Chiama SEMPRE check_availability con tenant_id=${tenant.id}, datetime in ISO, people, service.
   - MAI decidere tu se chiuso. Lascia che il server decida. NON dire "siamo chiusi" senza aver chiamato il tool.
5. Se DISPONIBILE, chiama IMMEDIATAMENTE book_appointment con: tenant_id, customer_name, customer_phone, service (Tavolo Pranzo/Cena), datetime ISO, people.
6. Se il tool ritorna SUCCESSO CONFERMATO, DEVI DIRE ESATTAMENTE:
   "Perfetto [nome], confermato per [giorno] alle [ora] per [persone] persone! Ti aspettiamo da ${businessName}! A presto!"
   - VIETATO dire: Mi dispiace, problema tech, contatta titolare, chiama 328..., non offriamo ristorazione.

REGOLE:
- Non dire MAI di chiamare il titolare se vedi SUCCESSO CONFERMATO. Solo se vedi ERRORE.
- Sii breve, calorosa, in italiano.
- Servizi validi: ${services}. Accetta solo questi.
- Non inventare disponibilità.
`;
  } else {
    // SALONE / ALTRO
    return `
Sei l'assistente vocale di ${businessName} a ${city}.
${knowledgeText}
Servizi: ${services}
Orari: ${openingHours}

OBIETTIVO: Prenotare appuntamento.

FLUSSO:
1. Chiedi nome, servizio desiderato (${services}), giorno e ora.
2. Chiama check_availability con tenant_id=${tenant.id}, datetime ISO, service.
3. Se DISPONIBILE, chiama book_appointment con tenant_id, customer_name, customer_phone, service, datetime.
4. Se SUCCESSO CONFERMATO, di: "Perfetto [nome], prenotato per [giorno] alle [ora] per [servizio]! Ti aspettiamo!"
5. Se ERRORE, allora puoi dire di contattare il titolare.

VIETATO dire "non offriamo ristorazione" se sei salone, ma non offrire tavoli.
Sii breve e in italiano.
`;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = body.tenant_id;

    if (!tenantId) return NextResponse.json({ error: 'manca tenant_id' }, { status: 400 });
    if (!VAPI_API_KEY) return NextResponse.json({ error: 'manca VAPI_API_KEY in env' }, { status: 500 });

    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (!tenant) return NextResponse.json({ error: 'tenant non trovato' }, { status: 404 });

    const { data: know } = await supabase.from('tenant_knowledge').select('info').eq('tenant_id', tenantId).maybeSingle();

    const systemPrompt = getSystemPrompt(tenant, know?.info || '');

    const tools = [
      {
        type: 'function',
        function: {
          name: 'check_availability',
          description: 'Controlla se il giorno/ora è libero',
          parameters: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'ID del tenant' },
              datetime: { type: 'string', description: 'Data e ora in formato ISO 8601 es: 2026-05-13T20:00:00Z' },
              service: { type: 'string', description: 'Servizio richiesto' },
              people: { type: 'number', description: 'Numero persone (solo ristorante)' }
            },
            required: ['tenant_id', 'datetime']
          }
        },
        server: { url: WEBHOOK_URL }
      },
      {
        type: 'function',
        function: {
          name: 'book_appointment',
          description: 'Prenota definitivamente',
          parameters: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              customer_name: { type: 'string' },
              customer_phone: { type: 'string' },
              service: { type: 'string' },
              datetime: { type: 'string', description: 'ISO datetime' },
              people: { type: 'number' },
              source: { type: 'string' }
            },
            required: ['tenant_id', 'customer_name', 'datetime', 'service']
          }
        },
        server: { url: WEBHOOK_URL }
      }
    ];

    const assistantPayload = {
      name: `Rispondo - ${tenant.business_name} - ${tenant.category}`,
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        tools,
        toolIds: undefined
      },
      voice: { provider: '11labs', voiceId: 'burt' },
      firstMessage: tenant.category === 'ristorante'
        ? `Ciao! Qui ${tenant.business_name}, per quante persone vuoi prenotare?`
        : `Ciao! Qui ${tenant.business_name}, come posso aiutarti a prenotare?`,
      metadata: { tenant_id: tenant.id, category: tenant.category },
      serverUrl: WEBHOOK_URL
    };

    let vapiAssistantId = tenant.vapi_assistant_id;
    let mode = 'updated';

    if (!vapiAssistantId) {
      // CREATE
      const res = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantPayload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('VAPI CREATE ERROR', data);
        return NextResponse.json({ error: 'VAPI create failed', details: data }, { status: 500 });
      }
      vapiAssistantId = data.id;
      mode = 'created';
    } else {
      // UPDATE
      const res = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantPayload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('VAPI UPDATE ERROR', data);
        // If assistant not found, recreate
        if (res.status === 404) {
          await supabase.from('tenants').update({ vapi_assistant_id: null }).eq('id', tenantId);
          return NextResponse.json({ error: 'assistant not found, cleared id, retry', details: data }, { status: 404 });
        }
        return NextResponse.json({ error: 'VAPI update failed', details: data }, { status: 500 });
      }
    }

    await supabase.from('tenants').update({ vapi_assistant_id: vapiAssistantId }).eq('id', tenantId);

    return NextResponse.json({ success: true, mode, assistant_id: vapiAssistantId, category: tenant.category, prompt_preview: systemPrompt.substring(0, 300) });

  } catch (e) {
    console.error('SYNC-VAPI ERROR', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, webhook: WEBHOOK_URL });
}