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
      const { data: newTenant, error } = await supabaseAdmin.from('tenants').insert({
          owner_id: userId,
          business_name: name || email.split('@')[0],
          email,
          city: 'Comacchio',
          services: ['Taglio','Piega','Colore','Barba','Balayage'],
          opening_hours: {
            lun:{open:'09:00',close:'19:00'},
            mar:{open:'09:00',close:'19:00'},
            mer:{open:'09:00',close:'19:00'},
            gio:{open:'09:00',close:'19:00'},
            ven:{open:'09:00',close:'19:00'},
            sab:{open:'09:00',close:'18:00'},
            dom:{closed:true}
          }
        }).select('*').single();
      if (error) throw error;
      tenant = newTenant;
    }

    await supabaseAdmin.from('profiles').upsert({ id: userId, tenant_id: tenant.id, email }, { onConflict: 'id' });

    // === NEW: FETCH EXTRA INFO ===
    const { data: knowledge } = await supabaseAdmin.from('tenant_knowledge').select('info').eq('tenant_id', tenant.id).maybeSingle();
    const { data: customerCount } = await supabaseAdmin.from('customers').select('phone',{count:'exact'}).eq('tenant_id', tenant.id);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';
    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
    const serverUrl = `${siteUrl}/api/vapi/webhook`;

    const systemPrompt = `
Sei la receptionist di "${tenant.business_name}" a ${tenant.city}. Italiana 100%, brevissima, una domanda alla volta, calorosa.

DATI FISSI:
tenant_id=${tenant.id}
Oggi={{now}} Europe/Rome
Servizi=${JSON.stringify(tenant.services)}
Orari=${JSON.stringify(tenant.opening_hours)}

INFO EXTRA NEGOZIO (USA QUESTO PER RISPONDERE):
${knowledge?.info || 'Nessuna info extra ancora. Chiedi al titolare di aggiungerla in dashboard.'}
${knowledge?.info? 'USA queste info per prezzi, dipendenti, parcheggio, regole. Se chiedono prezzo, rispondi da qui.' : ''}

CLIENTI ESISTENTI: ${customerCount||0} clienti salvati. Se riconosci numero, saluta per nome.

CONVERSIONE DATE OBBLIGATORIA:
- domani=+1 giorno, dopodomani=+2, lunedi/martedi=prossima occorrenza
- "alle 10"=10:00, "10 e mezza"=10:30, "15:30"=15:30
- Invia SEMPRE ISO: 2026-10-10T10:00:00 MAI "domani alle 10"

FLUSSO PERFETTO - NON SALTARE STEP:
1. Cliente: "voglio prenotare" -> Tu: "Certo! Come ti chiami?"
2. Cliente dice nome -> Se non capisci fai SPELLING: "Scusa non ho capito bene, puoi fare lo spelling? Es. M come Milano, A come Ancona, R come Roma..."
3. Poi: "Che servizio vuoi? Taglio, piega, colore o barba?"
4. Se senti "piaga/tagio/colre" correggi fuzzy a servizio corretto
5. Poi: "Quando vuoi venire?"
6. Converti data in ISO -> chiama check_availability con tenant_id="${tenant.id}", datetime ISO, duration 30
7. Se available=false -> proponi: "Alle 10 occupato, ho alle 11 o 11:30, va bene?"
8. Se available=true -> "Ho domani alle 10 libero, mi lasci un recapito telefonico?"
9. Dopo telefono -> book_appointment con customer_name, customer_phone, service, datetime ISO, tenant_id, source="ai-auto"
10. Conferma: "Perfetto [Nome], confermato [giorno] alle [ora] per [servizio]!"

REGOLE:
- 1 domanda alla volta, max 15 parole
- Conferma sempre prima di prenotare: "Quindi Mario Rossi domani alle 10 per taglio, corretto?"
- Mai dire tenant_id, mai dire "sistema", dì "controllo un attimo"
- Titolare "aggiungi per..." -> source="owner-voice" stesso flusso
`.trim();

    const vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "it",
          keywords: ["Taglio:2","Piega:2","Colore:2","Barba:2","Balayage:2","Mario:1.5","Comacchio:2","Rispondo:2","domani:2","dopodomani:2","lunedi:2","martedi:2","mercoledi:2"],
          smartFormat: true
        },
        voice: {
          provider: "11labs",
          voiceId: "pFZP5JQG7iQjIQuC4Bku",
          model: "eleven_multilingual_v2",
          stability: 0.6,
          similarityBoost: 0.8
        },
        model: {
          provider: "openai",
          model: "gpt-4o",
          temperature: 0.2,
          maxTokens: 200,
          messages: [{ role: "system", content: systemPrompt }],
          tools: [
            {
              type: "function",
              function: {
                name: 'check_availability',
                description: 'Controlla slot. Converti domani/dopodomani in ISO 2026-10-10T10:00:00 prima.',
                parameters: {
                  type: 'object',
                  properties: {
                    datetime:{type:'string', description:'ISO 2026-10-10T10:00:00'},
                    duration:{type:'number', default:30},
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
                description: 'Prenota DOPO check ok',
                parameters: {
                  type: 'object',
                  properties: {
                    customer_name:{type:'string'},
                    customer_phone:{type:'string'},
                    service:{type:'string'},
                    datetime:{type:'string'},
                    tenant_id:{type:'string'},
                    source:{type:'string', enum:["ai-auto","owner-voice","manual"]}
                  },
                  required:['tenant_id','datetime','customer_name','service','source']
                }
              },
              server: { url: serverUrl }
            }
          ]
        },
        firstMessage: `Ciao, ${tenant.business_name}, come posso aiutarti?`,
        endCallMessage: "Perfetto, ti aspetto! Ciao!",
        silenceTimeoutSeconds: 3.5,
        responseDelaySeconds: 0.6,
        backgroundSound: "office",
        voicemailMessage: "Ciao, al momento occupati, ti richiamo subito!"
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