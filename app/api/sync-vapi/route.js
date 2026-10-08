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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';

    const systemPrompt = `
Sei receptionist AI di "${tenant.business_name}" a ${tenant.city}.
Titolare: ${tenant.owner_phone}
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}
ID: ${tenant.id}

Se titolare (${tenant.owner_phone}) dice aggiungi/mettila -> check_availability poi book_appointment source="owner-voice"
Se cliente -> check_availability poi book_appointment source="ai-auto"
SEMPRE check prima di book.
`.trim();

    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

    const vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
        voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
        model: {
          provider: "openai",
          model: "gpt-4o",
          systemPrompt: systemPrompt,
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
      })
    });

    const txt = await vapiRes.text();
    console.log('SYNC VAPI', vapiRes.status, txt);
    let vapi;
    try { vapi = JSON.parse(txt); } catch { vapi = { raw: txt }; }

    if (!vapiRes.ok || !vapi.id) {
      return Response.json({ error: 'VAPI failed', status: vapiRes.status, details: vapi }, { status: 500 });
    }

    await supa.from('tenants').update({ vapi_assistant_id: vapi.id }).eq('id', tenant.id);

    return Response.json({ success: true, tenant_id: tenant.id, vapi_id: vapi.id });

  } catch(e){
    console.log('sync-vapi error', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}