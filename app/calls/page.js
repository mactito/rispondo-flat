"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { createClient } from '@supabase/supabase-js';

export default function CallsPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenantName, setTenantName] = useState("");

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!prof) { setLoading(false); return; }
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', prof.tenant_id).single();
    if (tenant) setTenantName(tenant.name);
    const res = await fetch(`/api/calls?tenant_id=${prof.tenant_id}`);
    const data = await res.json();
    setCalls(Array.isArray(data)? data : []);
    setLoading(false);
  };

  if (loading) return <div style={{padding:40}}>Caricamento...</div>;
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>📞 {tenantName || 'Rispondo'} - {calls.length} prenotazioni</h1>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', marginTop:20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ padding: 14, textAlign:'left' }}>Cliente</th><th style={{ padding: 14, textAlign:'left' }}>Telefono</th><th style={{ padding: 14, textAlign:'left' }}>Servizio</th><th style={{ padding: 14, textAlign:'left' }}>Data</th></tr></thead>
          <tbody>{calls.map(c => (<tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: 14 }}>{c.caller_name||'—'}</td><td style={{ padding: 14 }}>{c.from_number||'—'}</td><td style={{ padding: 14 }}>{c.service_booked||'—'}</td><td style={{ padding: 14 }}>{new Date(c.booking_time||c.created_at).toLocaleString('it-IT')}</td></tr>))}</tbody>
        </table>
        {calls.length===0 && <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>Nessuna prenotazione</div>}
      </div>
    </div>
  );
}