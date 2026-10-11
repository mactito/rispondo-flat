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
Sei receptionist AI di "${tenant.business_name}" a ${tenant.city}.
Titolare: ${tenant.owner_phone}
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}
Descrizione: ${tenant.description || ''}
ID: ${tenant.id}

INFO EXTRA NEGOZIO (IMPORTANTE - usa queste per rispondere a prezzi, dipendenti, regole):
${extraInfo || 'Nessuna info extra'}

REGOLE:
Se titolare (${tenant.owner_phone}) dice aggiungi/mettila -> check_availability poi book_appointment source="owner-voice"
Se cliente -> check_availability poi book_appointment source="ai-auto"
SEMPRE check prima di book.
Rispondi sempre in italiano, cordiale e breve. Se chiedono prezzo o chi fa cosa, usa INFO EXTRA.
`.trim();

    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

    const payload = {
      name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
      voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        functions: [
          {
            name: 'check_availability',
            description: 'Check free slot',
            parameters: {
              type: 'object',
              properties: {
                datetime: { type: 'string' },
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
            description: 'Book after check',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { type: 'string' },
                customer_phone: { type: 'string' },
                service: { type: 'string' },
                datetime: { type: 'string' },
                tenant_id: { type: 'string' },
                source: { type: 'string' }
              },
              required: ['tenant_id','source']
            }
          }
        ]
      },
      firstMessage: `Ciao, ${tenant.business_name}, sono l'assistente, come posso aiutarti?`,
      serverUrl: `${siteUrl}/api/vapi/webhook`
    };

    let vapiId = tenant.vapi_assistant_id;
    let vapiData;

    // If assistant already exists, UPDATE it (no duplicate)
    if (vapiId) {
      const updateRes = await fetch(`https://api.vapi.ai/assistant/${vapiId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updateTxt = await updateRes.text();
      console.log('SYNC VAPI UPDATE', updateRes.status, updateTxt);
      try { vapiData = JSON.parse(updateTxt); } catch { vapiData = { raw: updateTxt }; }

      // If update failed because ID not found, fallback to create
      if (!updateRes.ok && updateRes.status === 404) {
        vapiId = null;
      } else {
        if (!updateRes.ok) {
          return Response.json({ error: 'VAPI update failed', status: updateRes.status, details: vapiData }, { status: 500 });
        }
        return Response.json({ success: true, tenant_id: tenant.id, vapi_id: vapiId, mode: 'updated' });
      }
    }

    // CREATE only if no existing ID
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