export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js'

export async function POST(req){
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const body = await req.json()

  console.log('Received body:', body);

  const ownerPhone = body.owner_phone || body.phone || body.ownerPhone;
  const bizName = body.business_name || body.businessName || body.name;
  const city = body.city;
  const services = body.services;
  const openingHours = body.opening_hours || body.hours || {
    lun: { open: '09:00', close: '19:00' },
    mar: { open: '09:00', close: '19:00' },
    mer: { open: '09:00', close: '19:00' },
    gio: { open: '09:00', close: '19:00' },
    ven: { open: '09:00', close: '19:00' },
    sab: { open: '09:00', close: '18:00' },
    dom: { closed: true }
  };

  if (!bizName) {
    return Response.json({ error: 'Missing business_name' }, { status: 400 });
  }

  const { data: tenant, error } = await supa.from('tenants').insert([{
    business_name: bizName,
    city: city || 'Comacchio',
    owner_phone: ownerPhone,
    phone: ownerPhone,
    services: services || ['Taglio', 'Piega'],
    opening_hours: openingHours
  }]).select().single()

  if (error || !tenant) {
    console.log('Supabase insert error:', error);
    return Response.json({ error: 'DB error', details: error }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';

  const systemPrompt = `
Sei receptionist AI di "${tenant.business_name}" a ${tenant.city}.
Titolare numero: ${tenant.owner_phone}
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}

=== VARIAZIONE 1 - 2 MODALITA ===

MODALITA TITOLARE: Se il chiamante ha numero ${tenant.owner_phone} oppure dice "sono titolare", "aggiungi", "metti prenotazione":
- Capisci: nome cliente, telefono cliente, servizio, data e ora
- Chiama SEMPRE check_availability con tenant_id="${tenant.id}", datetime, duration 60
- Poi chiama book_appointment con tenant_id="${tenant.id}", customer_name, customer_phone, service, datetime, source="owner-voice"
- Rispondi cortissimo: "Fatto, salvato [nome] [data] [ora]. Slot bloccato."

MODALITA CLIENTE: Se è un cliente normale:
- Chiedi nome, servizio, data/ora
- Chiama check_availability con tenant_id="${tenant.id}"
- Se occupato, proponi gli orari liberi che ti ritorna
- Se cliente dice SI, chiama book_appointment con source="ai-auto" tenant_id="${tenant.id}"
- Rispondi calda, italiana, veloce

REGOLA FISSA: Chiama SEMPRE check_availability prima di book_appointment.
  `.trim()

  const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

  const vapiRes = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
      voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
      model: { 
        provider: 'openai', 
        model: 'gpt-4o',
        systemPrompt: systemPrompt,
        functions: [
          {
            name: 'check_availability',
            description: 'Controlla se slot libero, chiama SEMPRE prima di prenotare',
            parameters: {
              type: 'object',
              properties: {
                datetime: { type: 'string', description: 'ISO datetime es: 2025-05-14T21:00:00' },
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
            description: 'Salva prenotazione dopo aver verificato disponibilita',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { type: 'string' },
                customer_phone: { type: 'string' },
                service: { type: 'string' },
                datetime: { type: 'string' },
                date: { type: 'string' },
                booking_time: { type: 'string' },
                tenant_id: { type: 'string' },
                source: { type: 'string', enum: ['ai-auto', 'owner-voice'] }
              },
              required: ['tenant_id', 'source']
            }
          }
        ]
      },
      firstMessage: `Ciao, ${tenant.business_name}, sono l'assistente, come posso aiutarti?`,
      serverUrl: `${siteUrl}/api/vapi/webhook`
    })
  })

  const vapiText = await vapiRes.text();
  console.log('VAPI status', vapiRes.status, 'body', vapiText);
  let vapi;
  try { vapi = JSON.parse(vapiText); } catch { vapi = { raw: vapiText }; }

  if (!vapiRes.ok || !vapi.id) {
    console.log('VAPI failed but tenant created', vapi);
    return Response.json({ success: true, tenant_id: tenant.id, warning: 'VAPI failed', vapi_status: vapiRes.status, vapi_error: vapi }, { status: 200 })
  }

  await supa.from('tenants').update({ vapi_assistant_id: vapi.id }).eq('id', tenant.id)

  return Response.json({ success: true, tenant_id: tenant.id, vapi_id: vapi.id })
}