import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reads "Authorization: Bearer <supabase access token>" and returns the user, or null.
export async function getUserFromRequest(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

// The logged-in user must own the tenant (tenants.owner_id) or be linked through profiles.
export async function requireTenantAccess(req, tenantId) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: 'non autenticato', status: 401 };
  if (!tenantId) return { error: 'manca tenant_id', status: 400 };

  const { data: tenant } = await admin.from('tenants').select('id, owner_id').eq('id', tenantId).maybeSingle();
  if (!tenant) return { error: 'tenant non trovato', status: 404 };
  if (tenant.owner_id === user.id) return { user, tenant };

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!profile) return { error: 'non autorizzato', status: 403 };
  return { user, tenant };
}
