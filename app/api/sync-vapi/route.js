export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { buildVapiPrompt } from '@/lib/vapiPrompt';

export async function POST(req) {
  const { tenant_id } = await req.json();
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single();
  if (!tenant?.vapi_assistant_id) return Response.json({ ok: false, error: 'No assistant' });

  const prompt = buildVapiPrompt(tenant);

  await fetch(`https://api.vapi.ai/assistant/${tenant.vapi_assistant_id}`, {
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

  return Response.json({ ok: true });
}