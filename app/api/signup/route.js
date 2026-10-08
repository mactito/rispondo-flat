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

    // 1. Find or create tenant
    let { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('owner_id', userId).maybeSingle();

    if (!tenant) {
      const { data: newTenant, error } = await supabaseAdmin
       .from('tenants')
       .insert({
          owner_id: userId,
          business_name: name || email.split('@')[0],
          email,
          city: 'Comacchio',
          services: ['Taglio','Piega'],
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

    // 2. Create profile
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenant.id,
      email: email
    }, { onConflict: 'id' });

    // 3. CREATE VAPI ASSISTANT - FIXED ITALIAN VERSION
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';
    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
    const serverUrl = `${siteUrl}/api/vapi/webhook`;

    const systemPrompt = `
Sei la receptionist AI di "${tenant.business_name}" a ${tenant.city || 'Comacchio'}.
Parli SOLO in italiano, in modo naturale, breve e professionale.
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}
Data oggi: {{now}}

FLUSSO:
- Se il titolare dice "aggiungi/mettila/prenota per..." -> chiedi nome cliente, servizio, data/ora, poi chiama check_availability con tenant_id="${tenant.id}" e datetime ISO, poi book_appointment source="owner-voice"
- Se cliente chiama -> chiedi servizio e quando vuole venire, poi check_availability con tenant_id="${tenant.id}", poi book_appointment source="ai-auto"
- SEMPRE fai check_availability PRIMA di book_appointment.
- tenant_id fisso e obbligatorio: ${tenant.id}
- datetime deve essere ISO tipo 2026-10-09T10:00:00
- Sii breve, non ripetere l'ID al cliente.
`.trim();

    const vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
        // --- FIX 1: TRANSCRIBER ITALIANO ---
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "it"
        },
        // --- FIX 2: VOICE ITALIANA ---
        voice: {
          provider: "11labs",
          voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily - italiana
          model: "eleven_multilingual_v2"
        },
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }],
          // --- FIX 3: NEW TOOLS FORMAT ---
          tools: [
            {
              type: "function",
              function: {
                name: 'check_availability',
                description: 'Controlla se slot libero, chiama SEMPRE prima di prenotare',
                parameters: {
                  type: 'object',
                  properties: {
                    datetime:{type:'string', description: 'Data ora ISO es 2026-10-09T10:00:00'},
                    duration:{type:'number', description: 'Durata minuti default 30'},
                    tenant_id:{type:'string', description: 'ID tenant fisso'}
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
                description: 'Prenota appuntamento DOPO aver verificato disponibilità',
                parameters: {
                  type: 'object',
                  properties: {
                    customer_name:{type:'string'},
                    customer_phone:{type:'string'},
                    service:{type:'string'},
                    datetime:{type:'string', description: 'ISO datetime'},
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
        firstMessage: `Ciao, ${tenant.business_name}, sono l'assistente, come posso aiutarti?`,
        endCallMessage: "Perfetto, a presto!",
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