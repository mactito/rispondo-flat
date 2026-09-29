export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req){
  try{
    const { userId, email, name } = await req.json()
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Your table uses business_name, category, owner_phone
    const { data: tenant, error: tError } = await supabaseAdmin
      .from('tenants')
      .insert({ 
        business_name: name,
        category: 'salone',
        city: 'Comacchio',
        owner_phone: '+39 000 000000'
      })
      .select()
      .single()
    
    if(tError) throw tError

    const { error: pError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, email, tenant_id: tenant.id, is_paid: true })
    
    if(pError) throw pError

    return Response.json({ success: true, tenant_id: tenant.id })
  }catch(e){
    return Response.json({ error: e.message }, { status: 500 })
  }
}