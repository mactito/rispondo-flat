export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

export async function POST(req){
  try {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const body = await req.json();
    const tenantId = body.tenant_id || body.tenantId;
    
    if (!tenantId) {
      return Response.json({ error: 'tenant_id required' }, { status: 400 });
    }

    const { data: tenant, error: tenantError } = await supa
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return Response.json({ error: 'tenant not found', details: tenantError }, { status: 404 });
    }

    // === FETCH EXTRA KNOWLEDGE ===
    const { data: know } = await supa.from('tenant_knowledge').select('info').eq('tenant_id', tenantId).maybeSingle();
    const extraInfo = know?.info || "";

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';

    const systemPrompt = `
Sei l'assistente telefonico di "${tenant.business_name}" a ${tenant.city}.
Parli SOLO in italiano. Mai inglese. Solo italiano naturale, cordiale, breve, da receptionist vera.

Dati negozio:
Titolare: ${tenant.owner_phone}
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}
Descrizione: ${tenant.description || ''}
ID: ${tenant.id}

INFO EXTRA NEGOZIO (usala per prezzi, dipendenti, regole):
${extraInfo || 'Nessuna info extra'}

REGOLE FERREE:
1. Parli SOLO ITALIANO. Se cliente parla inglese, rispondi comunque in italiano.
2. Risposte brevi: max 2 frasi.
3. Cliente chiede appuntamento: chiedi nome, servizio, giorno/ora -> chiama check_availability -> poi book_appointment.
4. Se titolare (${tenant.owner_phone}) dice "aggiungi/mettila" -> source="owner-voice" altrimenti "ai-auto".
5. Non inventare prezzi: se non li sai, di "devo verificare con il titolare".
6. Mai dire che sei AI di VAPI/OpenAI. Sei l'assistente di ${tenant.business_name}.
`.trim();

    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

    const payload = {
      name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
      // ITALIAN VOICE FIX
      voice: { 
        provider: "11labs", 
        voiceId: "XrExE9yKIg1WjnnlVkGX",
        model: "eleven_multilingual_v2"
      },
      // ITALIAN TRANSCRIBER FIX - THIS FIXES HEARING
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "it",
        smartFormat: true
      },
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        functions: [
          {
            name: 'check_availability',
            description: 'Controlla disponibilità slot',
            parameters: {
              type: 'object',
              properties: {
                datetime: { type: 'string', description: 'ISO datetime' },
                date: { type: 'string' },
                time: { type: 'string' },
                duration: { type: 'number' },
                tenant_id: { type: 'string' }
              },
              required: ['tenant_id']
            }
          },
          {
            name: 'book_appointment',
            description: 'Prenota dopo check',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { type: 'string' },
                customer_phone: { type: 'string' },
                service: { type: 'string' },
                datetime: { type: 'string' },
                tenant_id: { type: 'string' },
                source: { type: 'string', enum: ["ai-auto", "owner-voice"] }
              },
              required: ['tenant_id','source','customer_name','datetime']
            }
          }
        ]
      },
      firstMessage: `Ciao, sono l'assistente di ${tenant.business_name}, come posso aiutarti?`,
      firstMessageMode: "assistant-speaks-first",
      serverUrl: `${siteUrl}/api/vapi/webhook`,
      language: "it",
      backgroundDenoisingEnabled: true
    };

    let vapiId = tenant.vapi_assistant_id;
    let vapiData;

    if (vapiId) {
      const updateRes = await fetch(`https://api.vapi.ai/assistant/${vapiId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updateTxt = await updateRes.text();
      console.log('SYNC VAPI UPDATE', updateRes.status, updateTxt);
      try { vapiData = JSON.parse(updateTxt); } catch { vapiData = { raw: updateTxt }; }
      if (!updateRes.ok && updateRes.status === 404) {
        vapiId = null;
      } else {
        if (!updateRes.ok) {
          return Response.json({ error: 'VAPI update failed', status: updateRes.status, details: vapiData }, { status: 500 });
        }
        return Response.json({ success: true, tenant_id: tenant.id, vapi_id: vapiId, mode: 'updated' });
      }
    }

    if (!vapiId) {
      const vapiRes = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const txt = await vapiRes.text();
      console.log('SYNC VAPI CREATE', vapiRes.status, txt);
      try { vapiData = JSON.parse(txt); } catch { vapiData = { raw: txt }; }
      if (!vapiRes.ok || !vapiData.id) {
        return Response.json({ error: 'VAPI create failed', status: vapiRes.status, details: vapiData }, { status: 500 });
      }
      await supa.from('tenants').update({ vapi_assistant_id: vapiData.id }).eq('id', tenant.id);
      return Response.json({ success: true, tenant_id: tenant.id, vapi_id: vapiData.id, mode: 'created' });
    }

  } catch(e){
    console.log('sync-vapi error', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}