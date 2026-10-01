export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildPrompt(tenant) {
  const services = tenant.services || [{ name: 'Taglio', duration: 30 }];
  const hours = tenant.opening_hours || {};
  const servicesText = services.map(s => `- ${s.name} (${s.duration} min)`).join('\n');
  const hoursText = Object.entries(hours).map(([d, h]) => h.closed ? `- ${d}: CHIUSO` : `- ${d}: ${h.open}-${h.close}`).join('\n');
  return `Sei receptionist AI di "${tenant.business_name}" a ${tenant.city}. SERVIZI:\n${servicesText}\nORARI:\n${hoursText}\nFLUSSO: Chiedi nome, servizio, data. Chiama check-availability. Se occupato proponi alternative stesso giorno "ho 10:30,11:00,15:00. Va bene? Altrimenti altro giorno?" Se dice altro giorno richiama check-availability. Solo se SI chiama book.`;
}

export async function POST() {
  const { data: tenants } = await supabaseAdmin.from('tenants').select('*').is('vapi_assistant_id', null);
  
  if (!tenants?.length) return Response.json({ ok: true, message: 'All tenants already have assistant', count: 0 });

  const results = [];
  for (const tenant of tenants) {
    try {
      const prompt = buildPrompt(tenant);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rispondo-flat-g7ns.vercel.app';
      
      const vapiRes = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${tenant.business_name} - Receptionist`,
          model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }] },
          voice: { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
          serverUrl: `${baseUrl}/api/book?tenant_id=${tenant.id}`,
          functions: [
            { name: 'check-availability', description: 'Controlla disponibilità', parameters: { type: 'object', properties: { date: { type: 'string' }, time: { type: 'string' }, datetime: { type: 'string' } } } },
            { name: 'book', description: 'Prenota', parameters: { type: 'object', properties: { caller_name: { type: 'string' }, service_booked: { type: 'string' }, booking_time: { type: 'string' }, from_number: { type: 'string' } }, required: ['caller_name', 'service_booked', 'booking_time'] } }
          ]
        })
      });
      
      const data = await vapiRes.json();
      if (data?.id) {
        await supabaseAdmin.from('tenants').update({ vapi_assistant_id: data.id }).eq('id', tenant.id);
        results.push({ business: tenant.business_name, assistant_id: data.id, status: 'created' });
      } else {
        results.push({ business: tenant.business_name, status: 'failed', error: data });
      }
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      results.push({ business: tenant.business_name, status: 'error', error: e.message });
    }
  }
  return Response.json({ ok: true, fixed: results.length, results });
}