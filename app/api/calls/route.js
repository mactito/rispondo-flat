import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .order('datetime_iso', { ascending: true })
  
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}