export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { userId, email, name } = await req.json()
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        business_name: name,
        category: 'salon',
        owner_email: email,
        onboarding_completed: false
      })
      .select()
      .single()

    if (tenantError) throw tenantError

    // 2. Link user to tenant
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email: email
      })
    
    if (profileError) throw profileError

    // 3. AUTO-CREATE VAPI ASSISTANT FOR THIS TENANT
    let vapiAssistantId = null
    try {
      const vapiRes = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${name} - AI Receptionist`,
          voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: `Sei la receptionist di ${name}, un salone a Comacchio. Rispondi sempre in italiano. Il tuo compito è prenotare appuntamenti. Chiedi: nome, servizio, giorno e ora. Sii gentile e breve.` }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "check_availability",
                  description: "Controlla disponibilità",
                  parameters: { type: "object", properties: { date: { type: "string" }, time: { type: "string" } } }
                },
                server: { url: `https://rispondo-flat-g7ns.vercel.app/api/check-availability?tenant_id=${tenant.id}` }
              },
              {
                type: "function",
                function: {
                  name: "book_appointment",
                  description: "Prenota appuntamento",
                  parameters: { type: "object", properties: { caller_name: { type: "string" }, service_booked: { type: "string" }, booking_time: { type: "string" }, from_number: { type: "string" } }, required: ["caller_name","service_booked","booking_time"] }
                },
                server: { url: `https://rispondo-flat-g7ns.vercel.app/api/book?tenant_id=${tenant.id}` }
              }
            ]
          },
          firstMessage: `Ciao! Qui ${name}, come posso aiutarti a prenotare?`
        })
      })
      
      const vapiData = await vapiRes.json()
      if (vapiData.id) {
        vapiAssistantId = vapiData.id
        // Save to tenant
        await supabaseAdmin.from('tenants').update({ vapi_assistant_id: vapiAssistantId }).eq('id', tenant.id)
      }
    } catch (e) {
      console.log("Vapi create failed (non-blocking):", e.message)
      // Don't fail signup if Vapi fails - we can create assistant later manually
    }

    return Response.json({ success: true, tenant_id: tenant.id, vapi_assistant_id: vapiAssistantId })

  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}