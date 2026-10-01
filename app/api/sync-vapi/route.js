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

export async function POST(req) {
  const { tenant_id } = await req.json();
  const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single();
  if (!tenant?.vapi_assistant_id) return Response.json({ ok: false, error: 'No assistant' }, { status: 400 });
  const prompt = buildVapiPrompt(tenant);
  await fetch(`https://api.vapi.ai/assistant/${tenant.vapi_assistant_id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }] } })
  });
  return Response.json({ ok: true });
}