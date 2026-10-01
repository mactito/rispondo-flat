export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { buildVapiPrompt } from '@/lib/vapiPrompt';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { tenant_id } = body;
    
    if (!tenant_id) return Response.json({ ok: false, error: 'Missing tenant_id' }, { status: 400 });

    const { data: tenant, error } = await supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single();
    if (error || !tenant) return Response.json({ ok: false, error: 'Tenant not found' }, { status: 404 });
    if (!tenant.vapi_assistant_id) return Response.json({ ok: false, error: 'No vapi_assistant_id' }, { status: 400 });

    const prompt = buildVapiPrompt(tenant);

    const res = await fetch(`https://api.vapi.ai/assistant/${tenant.vapi_assistant_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: prompt }]
        }
      })
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error('Vapi sync error:', data);
      return Response.json({ ok: false, vapiError: data }, { status: 500 });
    }

    return Response.json({ ok: true, assistant_id: tenant.vapi_assistant_id, business: tenant.business_name });

  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tenant_id = searchParams.get('tenant_id');
  if (!tenant_id) return Response.json({ ok: false, error: 'Use POST with tenant_id or GET?tenant_id=xxx' });
  
  // reuse POST logic
  const fakeReq = { json: async () => ({ tenant_id }) };
  return POST(fakeReq);
}