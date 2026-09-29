"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantName, setTenantName] = useState("");

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) { window.location.href = "/login"; return; }

    const { data: profile } = await supabase.from('profiles').select('tenant_id, is_paid').eq('id', user.id).single();
    if(!profile?.is_paid) { window.location.href = "/pay"; return; }

    // Get tenant name
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', profile.tenant_id).single();
    if(tenant) setTenantName(tenant.name);

    // Fetch only his calls
    const res = await fetch(`/api/calls?tenant_id=${profile.tenant_id}`);
    const data = await res.json();
    setCalls(data);
    setLoading(false);
  };

  const logout = async () => { await supabase.auth.signOut(); window.location.href="/login"; };

  const filtered = calls.filter(c => {
    if(!search) return true;
    const s = search.toLowerCase();
    return ((c.caller_name||"") + (c.from_number||"") + (c.service_booked||"")).toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const headers = ["Cliente","Telefono","Servizio","Data","Stato"];
    const rows = filtered.map(c => [c.caller_name||"", c.from_number||"", c.service_booked||"", c.booking_time||"", c.status||""]);
    const csv = [headers,...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rispondo-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  if(loading) return <div style={{padding:40}}>Caricamento dashboard...</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 900, margin:0 }}>📞 {tenantName || 'Rispondo'}</h1><p style={{ color: '#64748b', margin:0 }}>{filtered.length} prenotazioni</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 18px', borderRadius: 10, background: 'black', color: 'white', border: 0, fontWeight: 600, cursor: 'pointer' }}>⬇️ Export</button>
          <button onClick={logout} style={{ padding: '10px 18px', borderRadius: 10, background: 'white', border:'1px solid #e2e8f0', cursor:'pointer' }}>Esci</button>
        </div>
      </div>

      <input placeholder="Cerca cliente..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width: '100%', maxWidth: 400, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }} />

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', fontSize: 12, color: '#64748b', textAlign: 'left' }}>
            <tr><th style={{ padding: 14 }}>Cliente</th><th style={{ padding: 14 }}>Telefono</th><th style={{ padding: 14 }}>Servizio</th><th style={{ padding: 14 }}>Data</th><th style={{ padding: 14 }}>Stato</th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 14, fontWeight: 600 }}>{c.caller_name || '—'}</td>
                <td style={{ padding: 14 }}>{c.from_number || '—'}</td>
                <td style={{ padding: 14 }}>{c.service_booked || '—'}</td>
                <td style={{ padding: 14 }}>{new Date(c.booking_time || c.created_at).toLocaleString('it-IT')}</td>
                <td style={{ padding: 14 }}><span style={{ background: '#dcfce7', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>Nessuna prenotazione</div>}
      </div>
    </div>
  );
}