"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = [
  { key: 'lun', label: 'Lunedì' },
  { key: 'mar', label: 'Martedì' },
  { key: 'mer', label: 'Mercoledì' },
  { key: 'gio', label: 'Giovedì' },
  { key: 'ven', label: 'Venerdì' },
  { key: 'sab', label: 'Sabato' },
  { key: 'dom', label: 'Domenica' },
];

export default function OnboardingPage() {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extraInfo, setExtraInfo] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/signup"; return; }
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      if (!profile?.tenant_id) { setLoading(false); return; }
      const { data: t } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single();
      if (!t) { setLoading(false); return; }
      if (!t.services) t.services = [{ name: 'Taglio', duration: 30 }, { name: 'Piega', duration: 45 }];
      if (!t.opening_hours) t.opening_hours = {
        lun: { open: '09:00', close: '19:00', closed: false },
        mar: { open: '09:00', close: '19:00', closed: false },
        mer: { open: '09:00', close: '19:00', closed: false },
        gio: { open: '09:00', close: '19:00', closed: false },
        ven: { open: '09:00', close: '19:00', closed: false },
        sab: { open: '09:00', close: '18:00', closed: false },
        dom: { open: '09:00', close: '13:00', closed: true }
      };
      const allowed = ['salone','ristorante','officina','dentista','palestra','altro'];
      if (!allowed.includes(t.category)) t.category = 'salone';
      setTenant(t);
      const { data: know } = await supabase.from('tenant_knowledge').select('info').eq('tenant_id', t.id).maybeSingle();
      if (know?.info) setExtraInfo(know.info);
      setLoading(false);
    }
    load();
  }, []);

  const updateField = (field, value) => setTenant(prev => ({...prev, [field]: value }));
  const updateService = (idx, field, value) => {
    const newServices = [...tenant.services];
    newServices[idx][field] = value;
    updateField('services', newServices);
  };
  const addService = () => updateField('services', [...(tenant.services||[]), { name: 'Nuovo servizio', duration: 30 }]);
  const removeService = (idx) => updateField('services', tenant.services.filter((_, i) => i!== idx));
  const updateHours = (dayKey, field, value) => {
    const newHours = {...tenant.opening_hours };
    newHours[dayKey] = {...newHours[dayKey], [field]: value };
    updateField('opening_hours', newHours);
  };

  const save = async () => {
    if(!tenant.owner_phone){ alert("Inserisci telefono negozio!"); return; }
    if(saving) return;
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      business_name: tenant.business_name,
      city: tenant.city,
      category: tenant.category,
      owner_phone: tenant.owner_phone,
      phone: tenant.owner_phone,
      services: tenant.services,
      opening_hours: tenant.opening_hours,
      description: tenant.description,
      onboarding_completed: true
    }).eq('id', tenant.id);
    if (error) { alert(error.message); setSaving(false); return; }
    if (extraInfo) {
      await supabase.from('tenant_knowledge').upsert({
        tenant_id: tenant.id,
        info: extraInfo
      }, { onConflict: 'tenant_id' });
    }
    try {
      await fetch('/api/sync-vapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id })
      });
    } catch(e) {}
    window.location.href = '/calls?onboarded=1';
  };

  if (loading) return <div style={{ padding: 32, fontFamily: 'monospace' }}>Caricamento...</div>;
  if (!tenant) return <div style={{ padding: 32 }}>Nessun negozio trovato. Vai su /signup</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Configura il tuo negozio</h1>
        <p style={{ color: '#64748b', marginTop: 6 }}>Queste info verranno usate dalla tua AI al telefono</p>

        <div style={{ marginTop: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>Nome negozio</label>
          <input value={tenant.business_name||''} onChange={e=>updateField('business_name', e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Città</label>
            <input value={tenant.city||''} onChange={e=>updateField('city', e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Telefono negozio *</label>
            <input value={tenant.owner_phone||''} onChange={e=>updateField('owner_phone', e.target.value)} placeholder="+39 333..." style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #000', fontWeight: 700 }} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>Categoria</label>
          <select value={tenant.category||'salone'} onChange={e=>updateField('category', e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <option value="salone">Parrucchiere / Salone</option>
            <option value="ristorante">Ristorante</option>
            <option value="officina">Officina / Servizi</option>
            <option value="dentista">Dentista / Studio</option>
            <option value="palestra">Palestra</option>
            <option value="altro">Altro</option>
          </select>
        </div>

        <div style={{ marginTop: 16, border: '2px solid #facc15', background: '#fefce8', borderRadius: 12, padding: 16 }}>
          <label style={{ fontWeight: 900, fontSize: 14 }}>🧠 Info extra sul tuo negozio - Rende l'AI 10x più intelligente</label>
          <p style={{ fontSize: 11, color: '#854d0e', marginTop: 4 }}>Scrivi tutto: prezzi, dipendenti, regole. Es: "Taglio 25€, Colore 60€, Anna fa solo colore martedì/giovedì, Luca fa barba. Chiusi lunedì mattina. Parcheggio dietro. Solo contanti. Siamo in via Roma 12"</p>
          <textarea value={extraInfo} onChange={e=>setExtraInfo(e.target.value)} placeholder="Es: Abbiamo 3 dipendenti: Anna fa colore, Luca fa barba e taglio uomo. Prezzo taglio 25€, balayage 120€. Chiusi lunedì. Parcheggio dietro negozio..." style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: '1px solid #eab308', minHeight: 110, fontSize: 13 }} />
          <div style={{fontSize: 11, color: '#a16207', marginTop: 6}}>L'AI userà queste info per rispondere a "quanto costa?" "chi fa barba?" ecc.</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>Descrizione breve</label>
          <textarea value={tenant.description||''} onChange={e=>updateField('description', e.target.value)} placeholder="Es: Salone specializzato in balayage" style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', minHeight: 60 }} />
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontWeight: 800, fontSize: 14 }}>Servizi e durata</label>
            <button onClick={addService} style={{ fontSize: 12, background: 'black', color: 'white', border: 0, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>+ Aggiungi</button>
          </div>
          {(tenant.services||[]).map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 40px', gap: 8, marginTop: 8 }}>
              <input value={s.name} onChange={e=>updateService(i,'name',e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }} />
              <input type="number" value={s.duration} onChange={e=>updateService(i,'duration',parseInt(e.target.value)||30)} style={{ padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }} placeholder="min" />
              <button onClick={()=>removeService(i)} style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 10, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28 }}>
          <label style={{ fontWeight: 800, fontSize: 14 }}>Orari di apertura</label>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {DAYS.map(d => {
              const h = tenant.opening_hours?.[d.key] || { open: '09:00', close: '19:00', closed: false };
              return (
                <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 70px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                  <input type="time" disabled={h.closed} value={h.open} onChange={e=>updateHours(d.key,'open',e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input type="time" disabled={h.closed} value={h.close} onChange={e=>updateHours(d.key,'close',e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={h.closed} onChange={e=>updateHours(d.key,'closed',e.target.checked)} /> Chiuso</label>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ marginTop: 28, width: '100%', background: 'black', color: 'white', padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: saving?0.6:1 }}>
          {saving? 'Salvo e aggiorno AI...' : 'Salva e vai al Dashboard →'}
        </button>

        <div style={{marginTop:32,border:'1px solid #bbf7d0',borderRadius:12,padding:16,background:'#f0fdf4'}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800}}>📞 Inoltro dopo 15 sec?</h3>
          <div style={{marginTop:12,background:'black',color:'white',padding:12,borderRadius:8,fontFamily:'monospace',fontSize:13}}>
            <div>Componi: **61*+1NUMEROVAPI*11*15#</div>
          </div>
          <div style={{marginTop:10,fontSize:12,display:'grid',gap:4}}>
            <div>✅ Rispondi entro 15 sec → parli tu</div>
            <div>🤖 Non rispondi → va ad AI</div>
            <div>🔧 Disattiva: ##61#</div>
          </div>
        </div>

      </div>
    </div>
  );
}