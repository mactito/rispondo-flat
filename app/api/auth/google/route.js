export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tenant_id = searchParams.get('tenant_id');

  if (!tenant_id) {
    return Response.json({ error: 'Missing tenant_id - call /api/auth/google?tenant_id=YOUR_TENANT_ID' }, { status: 400 });
  }

  // FIX: prevent undefined
  const rawBase = process.env.NEXT_PUBLIC_BASE_URL || 'https://rispondo-flat-g7ns.vercel.app';
  const baseUrl = rawBase.replace(/\/$/, '');
  const cleanBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  
  const redirectUri = `${cleanBaseUrl}/api/auth/google/callback`;

  console.log("Starter using redirectUri:", redirectUri, "tenant:", tenant_id);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: tenant_id
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return Response.redirect(authUrl);
}