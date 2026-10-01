export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { buildVapiPrompt } from '@/lib/vapiPrompt';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .not('vapi_assistant_id', 'is', null);

    if (!tenants || tenants.length === 0) {
      return Response.json({ ok: true, message: 'No tenants with assistant' });
    }

    const results = [];

    for (const tenant of tenants) {
      try {
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

        results.push({
          business: tenant.business_name,
          id: tenant.id,
          assistant: tenant.vapi_assistant_id,
          status: res.ok ? 'updated' : 'failed'
        });

        // avoid rate limit
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        results.push({ business: tenant.business_name, status: 'error', error: e.message });
      }
    }

    return Response.json({ ok: true, synced: results.length, results });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ message: 'POST to /api/sync-all to update ALL assistants with new smart prompt' });
}