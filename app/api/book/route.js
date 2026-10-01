export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

async function getAccessToken(refresh_token) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  return data.access_token;
}

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get('tenant_id');
    if (!tenant_id) return Response.json({ error: 'Missing tenant_id' }, { status: 400 });

    const body = await req.json();

    let args = {};
    if (body.message?.toolCalls?.[0]?.function?.arguments) {
      args = typeof body.message.toolCalls[0].function.arguments === 'string'
       ? JSON.parse(body.message.toolCalls[0].function.arguments)
        : body.message.toolCalls[0].function.arguments;
    } else {
      args = body;
    }

    const caller_name = args.caller_name || args.name || 'Cliente';
    const from_number = args.from_number || args.phone || body.message?.customer?.number || 'unknown';
    const service_booked = args.service_booked || args.service || 'Taglio';
    const booking_time_str = args.booking_time || args.datetime || args.date;

    if (!booking_time_str) {
      return Response.json({ result: 'Manca la data, dimmi quando vuoi prenotare' });
    }

    const booking_time = new Date(booking_time_str);
    const end_time = new Date(booking_time.getTime() + 60 * 60 * 1000);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: tenant } = await supabaseAdmin
     .from('tenants')
     .select('business_name, google_refresh_token, calendar_id')
     .eq('id', tenant_id)
     .single();

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 1. Create event in THAT salon's calendar
    if (tenant.google_refresh_token) {
      try {
        const accessToken = await getAccessToken(tenant.google_refresh_token);
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.calendar_id || 'primary')}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: `${service_booked} - ${caller_name}`,
            description: `Cliente: ${caller_name}\nTelefono: ${from_number}\nServizio: ${service_booked}\nPrenotato da AI Rispondo`,
            start: { dateTime: booking_time.toISOString() },
            end: { dateTime: end_time.toISOString() }
          })
        });
      } catch (e) {
        console.log('Google error (non-blocking):', e.message);
      }
    }

    // 2. Save to calls table for dashboard
    await supabaseAdmin.from('calls').insert({
      tenant_id,
      caller_name,
      from_number,
      service_booked,
      booking_time: booking_time.toISOString(),
      status: 'confirmed'
    });

    return Response.json({
      result: `Perfetto ${caller_name}! Ho prenotato ${service_booked} per ${booking_time.toLocaleString('it-IT')} da ${tenant.business_name}. Ti aspettiamo!`
    });

  } catch (err) {
    console.error(err);
    return Response.json({ result: 'Errore prenotazione, riprova.' }, { status: 500 });
  }
}

export async function GET(req) {
  return Response.json({ ok: true, message: 'Book endpoint active. Use POST with?tenant_id=xxx' });
}