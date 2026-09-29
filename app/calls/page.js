"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CallsPage() {
  const supabase = createClientComponentClient();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) {
        window.location.href = "/login";
        return;
      }

      // Get profile with tenant_id
      const { data: prof, error: profError } = await supabase
       .from('profiles')
       .select('tenant_id, is_paid, email')
       .eq('id', user.id)
       .single();

      if(profError ||!prof) {
        console.error("Profile not found", profError);
        alert("Profilo non trovato. Contatta supporto.");
        setLoading(false);
        return;
      }

      setProfile(prof);

      if(!prof.is_paid) {
        window.location.href = "/pay";
        return;
      }

      // Get tenant name
      const { data: tenant } = await supabase
       .from('tenants')
       .select('name')
       .eq('id', prof.tenant_id)
       .single();

      if(tenant) setTenantName(tenant.name);

      // Fetch only his calls via API
      const res = await fetch(`/api/calls?tenant_id=${prof.tenant_id}`);
      const data = await res.json();

      if(Array.isArray(data)) {
        setCalls(data);
      } else {
        setCalls([]);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href="/login";
  };

  const filtered = calls.filter(c => {
    if(!search) return true;
    const s = search.toLowerCase();
    return ((c.caller_name||"") + (c.from_number||"") + (c.service_booked||"") + (c.customer_name||"")).toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const headers = ["Cliente","Telefono","Servizio","Data","Stato"];
    const rows = filtered.map(c => [
      c.caller_name || c.customer_name || "",
      c.from_number || c.customer_phone || "",
      c.service_booked || c.service_name || "",
      c.booking_time || c.created_at || "",
      c.status || ""
    ]);
    const csv = [headers,...rows].map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rispondo-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const deleteOne = async (id) => {
    if(!confirm("Eliminare questa prenotazione?")) return;
    await fetch(`/api/calls?id=${id}`, { method: 'DELETE' });
    // reload
    init();
  };

  if(loading) {
    return (
      <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:24, fontWeight:800}}>📞 Rispondo</div>
          <div style={{color:'#64748b', marginTop:8}}>Caricamento dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin:0 }}>📞 {tenantName || 'Rispondo'}</h1>
          <p style={{ color: '#64748b', margin:0, fontSize:14 }}>{filtered.length} prenotazioni • {profile?.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 18px', borderRadius: 10, background: 'black', color: 'white', border: 0, fontWeight: 600, cursor: 'pointer' }}>⬇️ Export CSV</button>
          <button onClick={logout} style={{ padding: '10px 18px', borderRadius: 10, background: 'white', border:'1px solid #e2e8f0', cursor:'pointer', fontWeight:600 }}>Esci</button>
        </div>
      </div>

      <input
        placeholder="Cerca cliente, telefono, servizio..."
        value={search}
        onChange={e=>setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 400, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20, outline:'none' }}
      />

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{overflowX:'auto'}}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead style={{ background: '#f8fafc', fontSize: 12, color: '#64748b', textAlign: 'left' }}>
              <tr>
                <th style={{ padding: 14 }}>Cliente</th>
                <th style={{ padding: 14 }}>Telefono</th>
                <th style={{ padding: 14 }}>Servizio</th>
                <th style={{ padding: 14 }}>Data Prenotazione</th>
                <th style={{ padding: 14 }}>Stato</th>
                <th style={{ padding: 14 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 14, fontWeight: 600 }}>{c.caller_name || c.customer_name || '—'}</td>
                  <td style={{ padding: 14 }}>{c.from_number || c.customer_phone || '—'}</td>
                  <td style={{ padding: 14 }}>{c.service_booked || c.service_name || '—'}</td>
                  <td style={{ padding: 14 }}>{c.booking_time? new Date(c.booking_time).toLocaleString('it-IT') : c.created_at? new Date(c.created_at).toLocaleString('it-IT') : '—'}</td>
                  <td style={{ padding: 14 }}><span style={{ background: c.status === 'booked'? '#dcfce7' : '#fef3c7', color: c.status === 'booked'? '#166534' : '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight:600 }}>{c.status || '—'}</span></td>
                  <td style={{ padding: 14 }}><button onClick={() => deleteOne(c.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>Nessuna prenotazione ancora. Fai una chiamata di test!</div>}
      </div>
    </div>
  );
}