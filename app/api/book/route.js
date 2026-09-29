export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_TENANT_ID = '79cd8e54-0b41-4089-84b1-b144b4fd2562'

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

export async function OPTIONS(){
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req){
  try{
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const body = await req.json()

    // Vapi sends called number here
    const calledNumber =
      body.message?.call?.phoneNumber?.number ||
      body.call?.phoneNumber?.number ||
      body.message?.call?.phoneNumberNumber ||
      null

    console.log("Called number:", calledNumber)

    let tenantId = null

    // AUTO-ROUTING: Find tenant by phone number
    if(calledNumber){
      const { data } = await supabaseAdmin
       .from('tenants')
       .select('id, name')
       .eq('phone_number', calledNumber)
       .single()
      if(data){
        tenantId = data.id
        console.log("Matched tenant:", data.name)
      }
    }

    // Fallback for your old clients with?tenant_id=
    if(!tenantId){
      const url = new URL(req.url)
      tenantId = url.searchParams.get('tenant_id')
    }

    // Parse tool args
    let data = body
    if (body.message?.toolCalls?.[0]?.function?.arguments){
      const args = body.message.toolCalls[0].function.arguments;
      data = typeof args === 'string'? JSON.parse(args) : args
    }
    if (body.toolCallList?.[0]?.function?.arguments){
      const args = body.toolCallList[0].function.arguments;
      data = typeof args === 'string'? JSON.parse(args) : args
    }

    const finalTenantId = tenantId || data.tenant_id || DEFAULT_TENANT_ID

    const { data: result, error } = await supabaseAdmin.from('calls').insert([{
      tenant_id: finalTenantId,
      caller_name: data.caller_name || 'Cliente',
      from_number: data.from_number || body.message?.call?.customer?.number || 'Sconosciuto',
      service_booked: data.service_booked || 'Appuntamento',
      booking_time: data.booking_time? new Date(data.booking_time).toISOString() : new Date().toISOString(),
      status: 'confirmed',
      called_number: calledNumber
    }]).select()

    if (error) throw error

    return new Response(JSON.stringify({ success: true, tenant_id: finalTenantId, calledNumber }), {
      status: 200,
      headers: {...corsHeaders(), 'Content-Type': 'application/json'}
    })
  }catch(e){
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {...corsHeaders(), 'Content-Type': 'application/json'}
    })
  }
}