export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildVapiPrompt(tenant) {
  const services = tenant.services || [{ name: 'Taglio', duration: 30 }];
  const hours = tenant.opening_hours || {};
  const servicesText = services.map(s => `- ${s.name} (${s.duration} minuti)`).join('\n');
  const hoursText = Object.entries(hours).map(([day, h]) => {
    if (h.closed) return `- ${day.toUpperCase()}: CHIUSO`;
    return `- ${day.toUpperCase()}: ${h.open} - ${h.close}`;
  }).join('\n');
  return `Sei la receptionist AI di "${tenant.business_name}" a ${tenant.city || 'Comacchio'}. Parli italiano, cordiale. SERVIZI (solo questi):\n${servicesText}\nORARI:\n${hoursText}\nFLUSSO: 1.Chiedi nome, servizio, giorno e ora. 2.Chiama SEMPRE check-availability. 3.Se occupato, propone alternative stesso giorno: "Alle 10 occupato, ma ho 10:30, 11:00, 15:00. Ti va bene? Altrimenti vuoi altro giorno?" 4.Se dice altro giorno, richiama check-availability. 5.Solo quando dice SI, chiama book con caller_name, service_booked, booking_time ISO. NON inventare orari, usa SOLO quelli di check-availability.`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password, business_name, city } = body;
    if (!email || !password || !business_name) return Response.json({ error: 'Manca dati' }, { status: 400 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    let userId = userData?.user?.id;
    if (userError && userError.message.includes('already exists')) {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) userId = found.id; else throw userError;
    } else if (userError) throw userError;

    const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').insert({
      business_name, city: city || 'Comacchio', category: 'salon', owner_email: email, owner_phone: '0000000000',
      services: [{ name: 'Taglio', duration: 30 }, { name: 'Piega', duration: 45 }, { name: 'Colore', duration: 90 }],
      opening_hours: {
        lun: { open: '09:00', close: '19:00', closed: false },
        mar: { open: '09:00', close: '19:00', closed: false },
        mer: { open: '09:00', close: '19:00', closed: false },
        gio: { open: '09:00', close: '19:00', closed: false },
        ven: { open: '09:00', close: '19:00', closed: false },
        sab: { open: '09:00', close: '18:00', closed: false },
        dom: { open: '09:00', close: '13:00', closed: true }
      },
      onboarding_completed: false
    }).select().single();
    if (tenantError) throw tenantError;

    await supabaseAdmin.from('profiles').upsert({ id: userId, tenant_id: tenant.id, email, is_paid: true });

    if (process.env.VAPI_API_KEY) {
      try {
        const prompt = buildVapiPrompt(tenant);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rispondo-flat-g7ns.vercel.app';
        const vapiRes = await fetch('https://api.vapi.ai/assistant', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${business_name} - Receptionist`,
            model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }] },
            voice: { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
            serverUrl: `${baseUrl}/api/book?tenant_id=${tenant.id}`,
            functions: [
              { name: 'check-availability', description: 'Controlla disponibilità e propone alternative', parameters: { type: 'object', properties: { date: { type: 'string' }, time: { type: 'string' }, datetime: { type: 'string' } } } },
              { name: 'book', description: 'Prenota', parameters: { type: 'object', properties: { caller_name: { type: 'string' }, service_booked: { type: 'string' }, booking_time: { type: 'string' }, from_number: { type: 'string' } }, required: ['caller_name', 'service_booked', 'booking_time'] } }
            ]
          })
        });
        const vapiData = await vapiRes.json();
        if (vapiData?.id) await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapiData.id }).eq('id', tenant.id);
      } catch (e) { console.log('Vapi skipped', e.message); }
    }
    return Response.json({ success: true, tenant_id: tenant.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}