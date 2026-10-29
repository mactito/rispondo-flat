import { createClient } from '@supabase/supabase-js';
import { normalizeServices } from './services';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rispondo-flat-g7ns.vercel.app').replace(/\/$/, '');
const WEBHOOK_URL = `${SITE_URL}/api/vapi/webhook`;
// Fallback Italian voice used when a tenant has no cloned voice (tenants.voice_id)
const DEFAULT_VOICE_ID = process.env.VAPI_VOICE_ID_IT;

const DAYS = [
  ['lun', 'lunedì'], ['mar', 'martedì'], ['mer', 'mercoledì'], ['gio', 'giovedì'],
  ['ven', 'venerdì'], ['sab', 'sabato'], ['dom', 'domenica'],
];

function formatHours(oh = {}) {
  return DAYS.map(([key, label]) => {
    const d = oh[key];
    if (!d) return `${label}: orario non indicato`;
    if (d.closed) return `${label}: chiuso`;
    return `${label}: dalle ${d.open} alle ${d.close}`;
  }).join('; ');
}

function commonPrompt({ assistantName, businessName, city, description, hoursText, knowledge }) {
  return `
# LINGUA
Parli sempre e solo in italiano.

# RUOLO
Sei ${assistantName}, l'assistente virtuale che risponde al telefono di ${businessName}${city ? `, a ${city}` : ''}. Hai già detto all'inizio della chiamata di essere un assistente virtuale: se te lo chiedono, confermalo con naturalezza e continua ad aiutare. Sei calda, tranquilla, concreta.
${description ? `Il locale: ${description}\n` : ''}
# COME PARLI
- Frasi brevi, massimo due per risposta, tono da telefonata.
- Una sola domanda alla volta. Mai elenchi.
- Dai del Lei; se il cliente ti dà del tu, passa al tu.
- Usa conferme naturali: "certo", "benissimo", "perfetto", "ok".
- Di' orari e numeri come si dicono a voce: "alle otto e mezza", "all'una", "sabato sera". I numeri di telefono a gruppi di tre o quattro cifre.
- Non ripetere tutto quello che dice il cliente, riprendi solo ciò che serve.
- Se non capisci: "Scusi, non ho sentito bene, può ripetere?"
- Non inventare mai prezzi, orari o servizi che non conosci.

# ORARI
${hoursText}
Se chiedono solo gli orari, rispondi con questi. Per le prenotazioni non decidere tu se è aperto: lascia decidere al sistema con check_availability.
${knowledge ? `
# INFO DEL LOCALE
${String(knowledge).slice(0, 4000)}
Usa queste informazioni quando servono. Se ti chiedono qualcosa che non sai, non inventare: di' che non hai l'informazione e offri di far richiamare.
` : ''}
# DATA E ORA
Adesso è: {{"now" | date: "%A %d %B %Y, %H:%M", "Europe/Rome"}} (ora italiana; se giorno o mese compaiono in inglese, traducili).
Converti "domani", "sabato", "stasera" in una data usando questo riferimento. Nei tool scrivi la data nel formato AAAA-MM-GGTHH:MM:00 con l'ora locale italiana, senza "Z" e senza fuso orario. Se l'ora è ambigua, chiedi conferma.

# SE QUALCOSA NON VA
Se un tool risponde ERRORE o non risponde, dì: "Mi scusi, il sistema mi sta dando qualche problema. Mi lascia nome e numero? La richiamiamo noi al più presto." Poi raccogli nome e telefono e chiudi gentilmente.
Se un tool risponde DATI NON VALIDI, correggi i dati come indicato e richiama il tool, senza parlare di problemi.
Se hai ricevuto SUCCESSO CONFERMATO, la prenotazione è fatta: non parlare di problemi.
`;
}

export function getSystemPrompt(tenant, knowledge) {
  const services = normalizeServices(tenant.services);
  const serviceNames = services.map((s) => s.name).join(', ');
  const isRisto = tenant.category === 'ristorante';
  const businessName = tenant.business_name || 'il nostro locale';

  const common = commonPrompt({
    assistantName: tenant.assistant_name || 'Sara',
    businessName,
    city: tenant.city || '',
    description: tenant.description || '',
    hoursText: formatHours(tenant.opening_hours),
    knowledge,
  });

  if (isRisto) {
    return `${common}
# PRENOTAZIONE TAVOLO
Il locale è un ristorante e il tuo compito è prenotare tavoli.
Ti servono: numero di persone, giorno e ora, nome, telefono. Chiedi solo ciò che manca, una cosa alla volta. Se il cliente ha già dato un'informazione, non richiederla.

1. Appena hai persone, giorno e ora, chiama check_availability (datetime, people). Non dire mai "siamo chiusi" senza averlo chiamato: decide il sistema, non tu.
2. Se non è disponibile, dillo in una frase e proponi al massimo due orari vicini. Non inventare mai disponibilità.
3. Se è disponibile e mancano nome e telefono, chiedili.
4. Ripeti il numero di telefono a gruppi di cifre e chiedi "Giusto?".
5. Chiama book_appointment con customer_name, customer_phone, datetime, people. Pranzo o cena lo decide il sistema.
6. Se il tool risponde SUCCESSO CONFERMATO, conferma con parole tue includendo nome, giorno, ora e numero di persone, e chiudi con calore. Esempio: "Perfetto Marco, confermato per sabato all'una per quattro persone. Vi aspettiamo da ${businessName}, a presto!"
`;
  }

  return `${common}
# PRENOTAZIONE APPUNTAMENTO
Servizi offerti: ${serviceNames || 'appuntamento'}. Accetta solo questi.
Ti servono: nome, servizio, giorno e ora, telefono. Chiedi solo ciò che manca, una cosa alla volta. Se il cliente ha già dato un'informazione, non richiederla.

1. Appena hai servizio, giorno e ora, chiama check_availability (datetime, service). Non dire mai "siamo chiusi" senza averlo chiamato: decide il sistema, non tu.
2. Se non è disponibile, dillo in una frase e proponi al massimo due orari vicini. Non inventare mai disponibilità.
3. Se è disponibile e manca il telefono, chiedilo. Ripetilo a gruppi di cifre e chiedi "Giusto?".
4. Chiama book_appointment con customer_name, customer_phone, service, datetime.
5. Se il tool risponde SUCCESSO CONFERMATO, conferma con parole tue includendo nome, giorno, ora e servizio, e chiudi con calore.
Se il cliente descrive un'emergenza medica grave (forte emorragia, difficoltà a respirare, trauma serio), digli di chiamare subito il 112.
`;
}

function buildTools(tenant, isRisto) {
  // tenant_id travels in the URL, so the model never has to type a UUID.
  const server = {
    url: `${WEBHOOK_URL}?tenant_id=${tenant.id}`,
    timeoutSeconds: 8,
    secret: process.env.VAPI_WEBHOOK_SECRET, // undefined is dropped by JSON.stringify
  };
  const datetimeDesc = 'Data e ora locale italiana, formato AAAA-MM-GGTHH:MM:00, senza Z e senza fuso orario';

  return [
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: "Controlla se il giorno e l'ora sono liberi. Chiamalo sempre prima di prenotare.",
        parameters: {
          type: 'object',
          properties: {
            datetime: { type: 'string', description: datetimeDesc },
            service: { type: 'string', description: 'Servizio richiesto (non serve per il ristorante)' },
            people: { type: 'number', description: 'Numero di persone (solo ristorante)' },
          },
          required: isRisto ? ['datetime', 'people'] : ['datetime'],
        },
      },
      server,
      messages: [
        { type: 'request-start', content: 'Un attimo che controllo.' },
        { type: 'request-delayed', content: 'Ci metto ancora un secondo.', timingMilliseconds: 2500 },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Conferma la prenotazione, solo dopo che check_availability ha risposto DISPONIBILE.',
        parameters: {
          type: 'object',
          properties: {
            customer_name: { type: 'string' },
            customer_phone: { type: 'string' },
            service: { type: 'string', description: 'Servizio scelto (non serve per il ristorante)' },
            datetime: { type: 'string', description: datetimeDesc },
            people: { type: 'number' },
          },
          required: isRisto
            ? ['customer_name', 'customer_phone', 'datetime', 'people']
            : ['customer_name', 'customer_phone', 'datetime', 'service'],
        },
      },
      server,
      messages: [
        { type: 'request-start', content: 'Perfetto, la segno subito.' },
        { type: 'request-delayed', content: 'Ancora un attimo.', timingMilliseconds: 2500 },
      ],
    },
  ];
}

// Builds and pushes the assistant for one tenant. Returns { status, body } for the route to send back.
export async function syncTenant(tenantId) {
  if (!VAPI_API_KEY) return { status: 500, body: { error: 'manca VAPI_API_KEY in env' } };

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (!tenant) return { status: 404, body: { error: 'tenant non trovato' } };

  const voiceId = tenant.voice_id || DEFAULT_VOICE_ID;
  if (!voiceId) return { status: 500, body: { error: 'nessuna voce: imposta VAPI_VOICE_ID_IT o tenants.voice_id' } };

  const { data: know } = await supabase.from('tenant_knowledge').select('info').eq('tenant_id', tenantId).maybeSingle();

  const isRisto = tenant.category === 'ristorante';
  const assistantName = tenant.assistant_name || 'Sara';
  const businessName = tenant.business_name || 'il nostro locale';
  const systemPrompt = getSystemPrompt(tenant, know?.info || '');

  // Italian greeting that also covers AI disclosure (EU AI Act art. 50) and recording notice.
  // If you turn call recording off in Vapi, drop the recording sentence.
  const firstMessage = isRisto
    ? `${businessName}, sono ${assistantName}, l'assistente virtuale. La chiamata può essere registrata. Mi dica!`
    : `${businessName}, sono ${assistantName}, l'assistente virtuale. La chiamata può essere registrata. Come posso aiutarla?`;

  const payload = {
    name: `Rispondo - ${tenant.business_name} - ${tenant.category}`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 200,
      messages: [{ role: 'system', content: systemPrompt }],
      tools: buildTools(tenant, isRisto),
    },
    voice: { provider: '11labs', voiceId, model: 'eleven_flash_v2_5' },
    transcriber: { provider: 'deepgram', model: 'nova-2', language: 'it' },
    firstMessageMode: 'assistant-speaks-first',
    firstMessage,
    startSpeakingPlan: {
      waitSeconds: 0.8,
      smartEndpointingEnabled: false,
      transcriptionEndpointingPlan: { onPunctuationSeconds: 0.2, onNoPunctuationSeconds: 1.5, onNumberSeconds: 1.2 },
    },
    stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.2, backoffSeconds: 1 },
    backgroundSound: 'office',
    metadata: { tenant_id: tenant.id, category: tenant.category },
    serverUrl: WEBHOOK_URL,
  };

  const headers = { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' };
  let assistantId = tenant.vapi_assistant_id;
  let mode = 'updated';

  if (assistantId) {
    const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (res.status === 404) {
      assistantId = null; // deleted in Vapi: recreate below instead of failing
    } else if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      console.error('VAPI UPDATE ERROR', details);
      return { status: 500, body: { error: 'VAPI update failed', details } };
    }
  }

  if (!assistantId) {
    const res = await fetch('https://api.vapi.ai/assistant', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      console.error('VAPI CREATE ERROR', data);
      return { status: 500, body: { error: 'VAPI create failed', details: data } };
    }
    assistantId = data.id;
    mode = 'created';
  }

  if (assistantId !== tenant.vapi_assistant_id) {
    await supabase.from('tenants').update({ vapi_assistant_id: assistantId }).eq('id', tenantId);
  }

  return { status: 200, body: { success: true, mode, assistant_id: assistantId } };
}
