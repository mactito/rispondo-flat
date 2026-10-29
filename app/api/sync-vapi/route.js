export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireTenantAccess } from '../../../lib/auth';
import { syncTenant } from '../../../lib/syncVapi';

// Only the owner of the tenant can re-sync its assistant.
// (A future cron should import syncTenant directly instead of calling this over HTTP.)
export async function POST(req) {
  try {
    const { tenant_id } = await req.json().catch(() => ({}));
    const access = await requireTenantAccess(req, tenant_id);
    if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

    const { status, body } = await syncTenant(tenant_id);
    return NextResponse.json(body, { status });
  } catch (e) {
    console.error('SYNC-VAPI ERROR', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
