
import { NextResponse } from 'next/server'
import { getSupabase } from '../../../lib/supabase.js'

export async function POST(req) {
  try {
    const body = await req.json()
    let { tenant_id, customer_name, customer_phone, datetime_iso, service_name } = body
    const supabase = getSupabase()
    
    if (!supabase) {
      return NextResponse.json({ success: true, message: `Prenotato ${service_name} per ${customer_name} (test mode)` })
    }

    if (!tenant_id) {
      const { data } = await supabase.from('tenants').select('id').limit(1).single()
      tenant_id = data?.id
    }

    const { data, error } = await supabase.from('calls').insert({
      tenant_id,
      from_number: customer_phone || 'unknown',
      caller_name: customer_name || 'Cliente',
      service_booked: service_name || 'Taglio',
      booking_time: datetime_iso || new Date().toISOString(),
      status: 'booked',
      intent: 'booking'
    }).select().single()

    if (error) throw error
    return NextResponse.json({ success: true, booking_id: data.id, message: `Perfetto ${customer_name}, prenotato!` })
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 200 })
  }
}
