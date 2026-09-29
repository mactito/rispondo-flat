
import { NextResponse } from 'next/server'
import { getSupabase } from '../../../lib/supabase.js'

export async function POST(req) {
  try {
    const body = await req.json().catch(()=>({}))
    const { tenant_id, date, time, service_name } = body
    const supabase = getSupabase()
    
    if (!supabase) {
      return NextResponse.json({ available: true, message: 'Libero (no DB yet)', start_iso: new Date().toISOString() })
    }

    let effectiveTenantId = tenant_id
    if (!effectiveTenantId) {
      const { data } = await supabase.from('tenants').select('id').limit(1).single()
      effectiveTenantId = data?.id
    }

    const start = new Date(`${date}T${time}:00`)
    const { data: conflicts } = await supabase.from('calls').select('id').eq('tenant_id', effectiveTenantId).eq('status','booked').gte('booking_time', start.toISOString()).lt('booking_time', new Date(start.getTime()+60*60000).toISOString())

    if (conflicts && conflicts.length > 0) {
      const alt = new Date(start.getTime() + 30*60000)
      return NextResponse.json({ available: false, alternative_time: alt.toTimeString().slice(0,5), alternative_iso: alt.toISOString() })
    }
    return NextResponse.json({ available: true, start_iso: start.toISOString() })
  } catch(e) {
    return NextResponse.json({ available: true, start_iso: new Date().toISOString() })
  }
}
