export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const tenant_id = searchParams.get('state');

  if (!code ||!tenant_id) return Response.json({ error: 'Missing code or tenant' }, { status: 400 });

  // FIX: never let it become undefined
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'https://rispondo-flat-g7ns.vercel.app').replace(/\/$/, '');
  // If VERCEL_URL has no https, add it
  const cleanBaseUrl = baseUrl.startsWith('http')? baseUrl : `https://${baseUrl}`;
  const redirectUri = `${cleanBaseUrl}/api/auth/google/callback`;

  console.log("Using redirectUri:", redirectUri);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenRes.json();

  if (tokens.error) {
    console.error("Token error:", tokens);
    return Response.json({ error: tokens.error_description || tokens.error, details: tokens, used_redirect_uri: redirectUri }, { status: 400 });
  }

  if (!tokens.refresh_token) {
    return new Response(`
      <html><body style="font-family: system-ui; padding: 40px;">
      <h2>Devi revocare l'accesso prima</h2>
      <p>Google da refresh_token solo la prima volta. Vai su <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> rimuovi Rispondo e riprova.</p>
      <a href="/calls">Torna al dashboard</a>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const calData = await calRes.json();
  const primaryCalendar = calData.items?.find(c => c.primary) || calData.items?.[0];

  await supabaseAdmin.from('tenants').update({
    google_refresh_token: tokens.refresh_token,
    calendar_id: primaryCalendar?.id || 'primary',
    onboarding_completed: true
  }).eq('id', tenant_id);

  return Response.redirect(`${cleanBaseUrl}/calls?connected=1`);
}