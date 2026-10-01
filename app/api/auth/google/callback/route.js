export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const tenant_id = searchParams.get('state');

  if (!code ||!tenant_id) return Response.json({ error: 'Missing code or tenant' }, { status: 400 });

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    // Google only gives refresh_token first time - if missing, tell user to revoke access and retry
    return new Response(`
      <html><body style="font-family: system-ui; padding: 40px;">
      <h2>Devi revocare l'accesso prima</h2>
      <p>Vai su <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> rimuovi Rispondo e riprova.</p>
      <a href="/calls">Torna al dashboard</a>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get primary calendar id
  const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const calData = await calRes.json();
  const primaryCalendar = calData.items?.find(c => c.primary) || calData.items?.[0];

  // Save to tenant
  await supabaseAdmin.from('tenants').update({
    google_refresh_token: tokens.refresh_token,
    calendar_id: primaryCalendar?.id || 'primary',
    onboarding_completed: true
  }).eq('id', tenant_id);

  return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/calls?connected=1`);
}