export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { userId, email, name } = await req.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Find or create tenant
    let { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('owner_id', userId).maybeSingle();

    if (!tenant) {
      const { data: newTenant, error } = await supabaseAdmin
     .from('tenants')
     .insert({ owner_id: userId, business_name: name || email.split('@')[0], email, city: 'Comacchio', services: ['Taglio','Piega'], opening_hours: { lun:{open:'09:00',close:'19:00'},mar:{open:'09:00',close:'19:00'},mer:{open:'09:00',close:'19:00'},gio:{open:'09:00',close:'19:00'},ven:{open:'09:00',close:'19:00'},sab:{open:'09:00',close:'18:00'},dom:{closed:true}} })
     .select('*')
     .single();
      if (error) throw error;
      tenant = newTenant;
    }

    // 2. Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenant.id,
      email: email
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    // 3. CREATE VAPI ASSISTANT - THIS WAS MISSING
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app';
    const vapiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

    const systemPrompt = `
Sei receptionist AI di "${tenant.business_name}" a ${tenant.city}.
Titolare: ${tenant.owner_phone || ''}
Servizi: ${JSON.stringify(tenant.services)}
Orari: ${JSON.stringify(tenant.opening_hours)}
ID: ${tenant.id}
Se titolare dice aggiungi/mettila -> check_availability poi book_appointment source="owner-voice"
Se cliente -> check_availability poi book_appointment source="ai-auto"
SEMPRE check prima di book.
`.trim();

    const vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Rispondo - ${tenant.business_name} - ${tenant.id.slice(0,8)}`,
        voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
        model: {
          provider: "openai", model: "gpt-4o", systemPrompt,
          functions: [
            { name: 'check_availability', description: 'Check free slot', parameters: { type: 'object', properties: { datetime:{type:'string'}, date:{type:'string'}, time:{type:'string'}, duration:{type:'number'}, tenant_id:{type:'string'} }, required:['tenant_id'] }},
            { name: 'book_appointment', description: 'Book after check', parameters: { type: 'object', properties: { customer_name:{type:'string'}, customer_phone:{type:'string'}, service:{type:'string'}, datetime:{type:'string'}, tenant_id:{type:'string'}, source:{type:'string'} }, required:['tenant_id','source'] }}
          ]
        },
        firstMessage: `Ciao, ${tenant.business_name}, sono l'assistente, come posso aiutarti?`,
        serverUrl: `${siteUrl}/api/vapi/webhook`
      })
    });

    const txt = await vapiRes.text();
    let vapi; try { vapi = JSON.parse(txt); } catch { vapi = { raw: txt }; }

    if (vapiRes.ok && vapi.id) {
      await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapi.id }).eq('id', tenant.id);
    }

    return NextResponse.json({ success: true, tenantId: tenant.id, vapi_id: vapi?.id, vapi_warning:!vapi?.id? vapi : null });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}