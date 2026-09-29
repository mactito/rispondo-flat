import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function DELETE(req) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const deleteTest = searchParams.get('test')

  if (deleteTest === 'true') {
    const { error } = await supabase.from('calls').delete().is('tenant_id', null)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ success: true, message: 'Test bookings deleted' }))
  }

  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

  const { error } = await supabase.from('calls').delete().eq('id', id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify({ success: true }))
}