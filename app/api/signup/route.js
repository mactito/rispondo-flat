export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { userId, email, name } = await req.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('owner_id', userId).maybeSingle();

    if (!tenant) {
      const { data: newTenant, error } = await supabaseAdmin
      .from('tenants')
      .insert({
          owner_id: userId,
          business_name: name || email.split('@')[0],
          email,
          city: 'Comacchio',
          services: ['Taglio','Piega','Colore'],
          opening_hours: {
            lun:{open:'09:00',close:'19:00'},
            mar:{open:'09:00',close:'19:00'},
            mer:{open:'09:00',close:'19:00'},
            gio:{open:'09:00',close:'19:00'},
            ven:{open:'09:00',close:'19:00'},
            sab:{open:'09:00',close:'18:00'},
            dom:{closed:true}
          }
        })
      .select('*')
      .single();
      if (error) throw error;
      tenant = newTenant;
    }

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenant.id,
      email: email
    }, { onConflict: 'id' });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';
    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
    const serverUrl = `${siteUrl}/api/vapi/webhook`;

    // --- TRAINED PROMPT V2 ---
    const systemPrompt = `
Sei la receptionist di "${tenant.business_name}" a ${tenant.city}. Parli SOLO italiano naturale, brevissima (max 15 parole), calda, professionale. NON sei un robot.

DATI FISSI:
tenant_id = ${tenant.id}
Ora attuale: {{now}} timezone Europe/Rome
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}

COME CONVERTI LE DATE - OBBLIGATORIO:
- "domani" = aggiungi 1 giorno a {{now}}
- "dopodomani" = +2 giorni
- "lunedì / martedì..." = prossima occorrenza di quel giorno
- "alle 10" = 10:00, "alle 10 e mezza" = 10:30, "alle 15" = 15:00
- Devi SEMPRE inviare ISO: 2026-10-10T10:00:00 - MAI inviare "domani alle 10"
Esempio: se oggi è 2026-10-09 e cliente dice "domani alle 10", tu invii "2026-10-10T10:00:00"

FLUSSO TASSATIVO:
1. Ascolta richiesta.
2. Se manca nome o telefono, chiedilo in UNA domanda breve.
3. Chiama check_availability con datetime ISO, duration 30, tenant_id.
4. Se available=true -> chiama book_appointment con customer_name, customer_phone, service, datetime ISO, tenant_id, source.
   source = "ai-auto" se cliente, "owner-voice" se titolare dice "aggiungi per..."
5. Se available=false -> proponi 2 alternative: "Alle 10 non ho posto, ho alle 11 o alle 11:30, ti va bene?"
6. Dopo prenotazione: "Perfetto [nome], confermato [giorno] alle [ora] per [servizio], a presto!"

REGOLE:
- Mai dire tenant_id al cliente
- Mai dire "sto verificando disponibilità nel sistema" - dì "controllo un attimo"
- Se non capisci, chiedi: "Mi dici giorno e ora? Esempio domani alle 10"
- Sii velocissima, non fare discorsi lunghi
`.trim();

    const vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
        transcriber: { provider: "deepgram", model: "nova-2", language: "it" },
        voice: { provider: "11labs", voiceId: "pFZP5JQG7iQjIQuC4Bku", model: "eleven_multilingual_v2" },
        model: {
          provider: "openai",
          model: "gpt-4o", // TRAINED: better than mini for Italian dates
          temperature: 0.2,
          messages: [{ role: "system", content: systemPrompt }],
          tools: [
            {
              type: "function",
              function: {
                name: 'check_availability',
                description: 'Controlla disponibilità. Input OBBLIGATORIO datetime in ISO 2026-10-10T10:00:00. Converti domani/dopodomani in ISO prima di chiamare.',
                parameters: {
                  type: 'object',
                  properties: {
                    datetime:{type:'string', description: 'ISO esatto 2026-10-10T10:00:00 Europe/Rome'},
                    duration:{type:'number', default: 30},
                    tenant_id:{type:'string'}
                  },
                  required:['tenant_id','datetime']
                }
              },
              server: { url: serverUrl }
            },
            {
              type: "function",
              function: {
                name: 'book_appointment',
                description: 'Prenota DOPO check_availability OK',
                parameters: {
                  type: 'object',
                  properties: {
                    customer_name:{type:'string'},
                    customer_phone:{type:'string'},
                    service:{type:'string'},
                    datetime:{type:'string', description: 'ISO 2026-10-10T10:00:00'},
                    tenant_id:{type:'string'},
                    source:{type:'string', enum: ["ai-auto","owner-voice","manual"]}
                  },
                  required:['tenant_id','datetime','customer_name','service','source']
                }
              },
              server: { url: serverUrl }
            }
          ]
        },
        firstMessage: `Ciao, ${tenant.business_name}, come posso aiutarti?`,
        endCallMessage: "Perfetto, ti aspetto, ciao!",
        firstMessageMode: "assistant-speaks-first"
      })
    });

    const txt = await vapiRes.text();
    let vapi; try { vapi = JSON.parse(txt); } catch { vapi = { raw: txt }; }
    if (vapiRes.ok && vapi.id) {
      await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapi.id }).eq('id', tenant.id);
    }
    return NextResponse.json({ success: true, tenantId: tenant.id, vapi_id: vapi?.id, vapi_response: vapi });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}