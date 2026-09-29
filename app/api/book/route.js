export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_TENANT_ID = '79cd8e54-0b41-4089-84b1-b144b4fd2562'

export async function POST(req) {
  try {
    // Create client INSIDE request, not at top level
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const body = await req.json()
    let data = body

    // Handle different Vapi formats
    if (body.message?.toolCalls?.[0]?.function?.arguments) {
      const args = body.message.toolCalls[0].function.arguments
      data = typeof args === 'string'? JSON.parse(args) : args
    }
    if (body.toolCallList?.[0]?.function?.arguments) {
      const args = body.toolCallList[0].function.arguments
      data = typeof args === 'string'? JSON.parse(args) : args
    }

    const finalTenantId = data.tenant_id || DEFAULT_TENANT_ID

    const { data: result, error } = await supabaseAdmin.from('calls').insert([{
      tenant_id: finalTenantId,
      caller_name: data.caller_name || 'Cliente',
      from_number: data.from_number || 'Sconosciuto',
      service_booked: data.service_booked || 'Appuntamento',
      booking_time: data.booking_time? new Date(data.booking_time).toISOString() : new Date().toISOString(),
      status: 'confirmed'
    }]).select()

    if (error) {
      console.error(error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: result })
  } catch (e) {
    console.error(e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}