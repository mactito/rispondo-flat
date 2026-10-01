export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function buildVapiPrompt(tenant) {
  const services = tenant.services || [{ name: 'Taglio', duration: 30 }];
  const hours = tenant.opening_hours || {};
  const servicesText = services.map(s => `- ${s.name} (${s.duration} minuti)`).join('\n');
  const hoursText = Object.entries(hours).map(([day, h]) => {
    if (h.closed) return `- ${day.toUpperCase()}: CHIUSO`;
    return `- ${day.toUpperCase()}: ${h.open} - ${h.close}`;
  }).join('\n');
  return `Sei la receptionist AI di "${tenant.business_name}" a ${tenant.city}. SERVIZI:\n${servicesText}\nORARI:\n${hoursText}\nFLUSSO: Chiedi nome, servizio, data. Chiama check-availability. Se occupato, proponi alternative stesso giorno "ho 10:30, 11:00, 15:00. Ti va bene? Altrimenti altro giorno?" Se dice altro giorno, richiama check-availability. Solo se SI, chiama book.`;
}

export async function POST() {
  const { data: tenants } = await supabaseAdmin.from('tenants').select('*').not('vapi_assistant_id', 'is', null);
  const results = [];
  for (const tenant of tenants || []) {
    try {
      const prompt = buildVapiPrompt(tenant);
      const res = await fetch(`https://api.vapi.ai/assistant/${tenant.vapi_assistant_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }] } })
      });
      results.push({ business: tenant.business_name, status: res.ok ? 'updated' : 'failed' });
      await new Promise(r => setTimeout(r, 500));
    } catch (e) { results.push({ business: tenant.business_name, status: 'error' }); }
  }
  return Response.json({ ok: true, synced: results.length, results });
}