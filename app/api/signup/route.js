export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password, business_name, city } = body;

    if (!email || !password || !business_name) {
      return Response.json({ error: 'Manca email, password o nome negozio' }, { status: 400 });
    }

    // 1. Create auth user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    // If user already exists, get it
    let userId = userData?.user?.id;
    if (userError && userError.message.includes('already exists')) {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing.users.find(u => u.email === email);
      if (found) userId = found.id;
      else throw userError;
    } else if (userError) {
      throw userError;
    }

    // 2. Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        business_name: business_name,
        city: city || 'Comacchio',
        category: 'salon',
        owner_email: email,
        owner_phone: '0000000000',
        services: [
          { name: 'Taglio', duration: 30 },
          { name: 'Piega', duration: 45 },
          { name: 'Colore', duration: 90 }
        ],
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
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // 3. Create / update profile linking user to tenant
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenant.id,
      email: email,
      is_paid: true
    });

    // 4. Optional: Auto-create Vapi assistant if key exists
    if (process.env.VAPI_API_KEY && tenant) {
      try {
        const vapiRes = await fetch('https://api.vapi.ai/assistant', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `${business_name} - Receptionist`,
            model: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Sei la receptionist di ${business_name} a ${city || 'Comacchio'}. Parli italiano, sei gentile e professionale. Il tuo compito è prenotare appuntamenti. Chiedi sempre nome, servizio e data/ora. Usa check-availability prima di confermare.`
                }
              ]
            },
            voice: { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
            serverUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/book?tenant_id=${tenant.id}`,
          })
        });
        const vapiData = await vapiRes.json();
        if (vapiData?.id) {
          await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapiData.id }).eq('id', tenant.id);
        }
      } catch (e) {
        console.log('Vapi auto-create skipped:', e.message);
      }
    }

    return Response.json({ 
      success: true, 
      user_id: userId,
      tenant_id: tenant.id,
      redirect: '/onboarding'
    });

  } catch (err) {
    console.error('Signup error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}