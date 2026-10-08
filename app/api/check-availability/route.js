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

function getDayKey(date) {
  const days = ['dom','lun','mar','mer','gio','ven','sab'];
  return days[date.getDay()];
}

function generateSlots(openStr, closeStr, busySlots, date) {
  const [oh, om] = openStr.split(':').map(Number);
  const [ch, cm] = closeStr.split(':').map(Number);
  const open = new Date(date); open.setHours(oh, om, 0, 0);
  const close = new Date(date); close.setHours(ch, cm, 0, 0);
  const slots = [];
  let cursor = new Date(open);
  while (cursor < close) {
    const slotEnd = new Date(cursor.getTime() + 30*60000);
    const isBusy = busySlots.some(b => {
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);
      return cursor < bEnd && slotEnd > bStart;
    });
    if (!isBusy && cursor > new Date()) {
      slots.push(new Date(cursor));
    }
    cursor = slotEnd;
  }
  return slots.slice(0, 8);
}

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    let tenant_id = searchParams.get('tenant_id');
    const body = await req.json();

    let args = {};
    if (body.message?.toolCalls?.[0]?.function?.arguments) {
      args = typeof body.message.toolCalls[0].function.arguments === 'string'
     ? JSON.parse(body.message.toolCalls[0].function.arguments)
        : body.message.toolCalls[0].function.arguments;
    } else args = body;

    // Variation 1: tenant_id can come from query OR from VAPI args
    if (!tenant_id) tenant_id = args.tenant_id;

    let checkDateStr = args.date || args.datetime || args.time;
    if (!checkDateStr) return Response.json({ result: 'Dimmi che giorno e ora vuoi' });

    let checkDate = new Date(checkDateStr.includes('T')? checkDateStr : `${args.date}T${args.time || '10:00'}`);
    if (isNaN(checkDate.getTime())) checkDate = new Date();

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single();

    if (!tenant) return Response.json({ result: 'Errore negozio non trovato' });

    const dayKey = getDayKey(checkDate);
    const dayHours = tenant.opening_hours?.[dayKey];

    if (dayHours?.closed) {
      return Response.json({
        result: `${dayKey.toUpperCase()} siamo chiusi. Vuoi provare un altro giorno? Dimmi quale giorno preferisci e ti dico gli orari liberi.`,
        closed: true
      });
    }

    const openStr = dayHours?.open || '09:00';
    const closeStr = dayHours?.close || '19:00';

    let busySlots = [];
    if (tenant.google_refresh_token) {
      try {
        const accessToken = await getAccessToken(tenant.google_refresh_token);
        const calendarId = tenant.calendar_id || 'primary';
        const dayStart = new Date(checkDate); const [oh,om] = openStr.split(':').map(Number); dayStart.setHours(oh,om,0,0);
        const dayEnd = new Date(checkDate); const [ch,cm] = closeStr.split(':').map(Number); dayEnd.setHours(ch,cm,0,0);

        const freeBusyRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeMin: dayStart.toISOString(), timeMax: dayEnd.toISOString(), items: [{ id: calendarId }] })
        });
        const fbData = await freeBusyRes.json();
        busySlots = fbData.calendars?.[calendarId]?.busy || [];
      } catch(e) { console.log('freeBusy error', e.message); }
    }

    // Also check your own calls table to avoid double booking even if Google sync delayed
    const dayStartISO = new Date(checkDate); dayStartISO.setHours(0,0,0,0);
    const dayEndISO = new Date(checkDate); dayEndISO.setHours(23,59,59,999);
    const { data: existingCalls } = await supabaseAdmin.from('calls').select('booking_time').eq('tenant_id', tenant_id).gte('booking_time', dayStartISO.toISOString()).lte('booking_time', dayEndISO.toISOString());
    if (existingCalls) {
      existingCalls.forEach(c => {
        busySlots.push({ start: c.booking_time, end: new Date(new Date(c.booking_time).getTime()+60*60000).toISOString() });
      });
    }

    const availableSlots = generateSlots(openStr, closeStr, busySlots, checkDate);
    const requestedSlotBusy = busySlots.some(b => {
      const bStart = new Date(b.start); const bEnd = new Date(b.end);
      const reqEnd = new Date(checkDate.getTime() + 60*60000);
      return checkDate < bEnd && reqEnd > bStart;
    });

    const isOutsideHours = () => {
      const [oh,om] = openStr.split(':').map(Number);
      const [ch,cm] = closeStr.split(':').map(Number);
      const mins = checkDate.getHours()*60 + checkDate.getMinutes();
      return mins < oh*60+om || mins > ch*60+cm-30;
    };

    const formatTime = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const formatDay = (d) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

    if (requestedSlotBusy || isOutsideHours()) {
      if (availableSlots.length === 0) {
        return Response.json({
          result: `Per ${formatDay(checkDate)} siamo al completo dalle ${openStr} alle ${closeStr}. Vuoi che ti proponga un altro giorno? Dimmi quale giorno preferisci.`,
          available: []
        });
      }
      const options = availableSlots.slice(0,4).map(formatTime).join(', ');
      return Response.json({
        result: `L'orario ${formatTime(checkDate)} non è disponibile. Oggi ${formatDay(checkDate)} ho libero alle: ${options}. Ti va bene uno di questi? Se no, dimmi un altro giorno e ti dico gli orari liberi.`,
        available: availableSlots.map(d=>d.toISOString())
      });
    } else {
      const options = availableSlots.filter(s => Math.abs(s - checkDate) > 30*60000).slice(0,3).map(formatTime).join(', ');
      return Response.json({
        result: `Sì, ${formatTime(checkDate)} di ${formatDay(checkDate)} è libero! Vuoi che confermo? Ho anche ${options} se preferisci un altro orario oggi.`,
        available: availableSlots.map(d=>d.toISOString())
      });
    }

  } catch (err) {
    console.error(err);
    return Response.json({ result: 'Dimmi giorno e ora, ti dico subito se è libero' });
  }
}

export async function GET(req) { return POST(req); }