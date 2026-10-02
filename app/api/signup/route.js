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
  const hoursText = Object.entries(hours).map(([day, h]) => h.closed ? `- ${day.toUpperCase()}: CHIUSO` : `- ${day.toUpperCase()}: ${h.open} - ${h.close}`).join('\n');
  return `Sei la receptionist AI di "${tenant.business_name}". SERVIZI:\n${servicesText}\nORARI:\n${hoursText}\nFLUSSO: Chiedi nome, servizio, giorno/ora. Chiama SEMPRE check-availability. Se occupato proponi alternative. Solo se SI chiama book.`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("SIGNUP BODY:", body);
    
    // YOUR FRONTEND SENDS THIS:
    const email = body.email;
    const userId = body.userId; // from supabase.auth.signUp
    const business_name = body.name; // you call it name
    const city = body.city || 'Comacchio';

    if (!email || !business_name || !userId) {
      return Response.json({ error: `Manca dati - email:${!!email} business:${!!business_name} userId:${!!userId} - ricevuto: ${JSON.stringify(body)}` }, { status: 400 });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').insert({
      business_name,
      city,
      category: 'salone', // FIXED! was 'salon' -> violates check constraint
      owner_email: email,
      owner_phone: '0000000000',
      services: [{ name: 'Taglio', duration: 30 }, { name: 'Piega', duration: 45 }],
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

    // Vapi optional
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
              { name: 'check-availability', parameters: { type: 'object', properties: { date: { type: 'string' }, time: { type: 'string' } } } },
              { name: 'book', parameters: { type: 'object', properties: { caller_name: { type: 'string' }, service_booked: { type: 'string' }, booking_time: { type: 'string' } }, required: ['caller_name', 'service_booked', 'booking_time'] } }
            ]
          })
        });
        const vapiData = await vapiRes.json();
        if (vapiData?.id) await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapiData.id }).eq('id', tenant.id);
      } catch (e) {}
    }

    return Response.json({ success: true, tenant_id: tenant.id });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}