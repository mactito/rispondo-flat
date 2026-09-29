"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadCalls = () => {
    fetch("/api/calls")
      .then(r => r.json())
      .then(data => { setCalls(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { loadCalls(); }, []);

  const exportCSV = () => {
    const headers = ["Cliente","Telefono","Servizio","Data","Stato"];
    const rows = filtered.map(c => [
      (c.caller_name || c.customer_name || "").replace(/"/g,''),
      (c.from_number || c.customer_phone || ""),
      (c.service_booked || c.service_name || ""),
      (c.booking_time || c.created_at || ""),
      (c.status || "")
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rispondo-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const deleteOne = async (id) => {
    if (!confirm("Eliminare?")) return;
    await fetch(`/api/calls?id=${id}`, { method: 'DELETE' });
    loadCalls();
  };

  const deleteTest = async () => {
    if (!confirm("Eliminare tutti i test NULL?")) return;
    await fetch(`/api/calls?test=true`, { method: 'DELETE' });
    loadCalls();
  };

  let filtered = [...calls];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c => 
      ((c.caller_name || c.customer_name || "") + (c.from_number || c.customer_phone || "") + (c.service_booked || c.service_name || "")).toLowerCase().includes(s)
    );
  }
  if (statusFilter !== "all") filtered = filtered.filter(c => c.status === statusFilter);
  if (dateFilter !== "all") {
    const now = new Date();
    filtered = filtered.filter(c => {
      const d = new Date(c.booking_time || c.created_at);
      if (dateFilter === "today") return d.toDateString() === now.toDateString();
      if (dateFilter === "week") { const w = new Date(); w.setDate(now.getDate()-7); return d >= w; }
      if (dateFilter === "month") return d.getMonth() === now.getMonth();
      return true;
    });
  }

  if (loading) return <div style={{padding:40}}>Loading...</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 800, margin:0 }}>📞 Rispondo</h1><p style={{ color: '#64748b' }}>{filtered.length} / {calls.length}</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 18px', borderRadius: 10, background: 'black', color: 'white', border: 0, fontWeight: 600, cursor: 'pointer' }}>⬇️ Export CSV</button>
          <button onClick={deleteTest} style={{ padding: '10px 18px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600, cursor: 'pointer' }}>🗑️ Pulisci Test</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '20px 0', flexWrap: 'wrap' }}>
        <input placeholder="Cerca cliente, telefono..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 280px', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <option value="all">Tutte</option><option value="today">Oggi</option><option value="week">7 giorni</option><option value="month">Mese</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <option value="all">Tutti stati</option><option value="booked">Booked</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', fontSize: 12, color: '#64748b', textAlign: 'left' }}>
            <tr><th style={{ padding: 14 }}>Cliente</th><th style={{ padding: 14 }}>Telefono</th><th style={{ padding: 14 }}>Servizio</th><th style={{ padding: 14 }}>Data</th><th style={{ padding: 14 }}>Stato</th><th style={{ padding: 14 }}></th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9', background: !c.tenant_id ? '#fffbeb' : 'white' }}>
                <td style={{ padding: 14, fontWeight: 600 }}>{c.caller_name || c.customer_name || '—'}</td>
                <td style={{ padding: 14 }}>{c.from_number || c.customer_phone || '—'}</td>
                <td style={{ padding: 14 }}>{c.service_booked || c.service_name || '—'}</td>
                <td style={{ padding: 14 }}>{new Date(c.booking_time || c.created_at).toLocaleString('it-IT')}</td>
                <td style={{ padding: 14 }}><span style={{ background: c.status === 'booked' ? '#dcfce7' : '#fef3c7', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>{c.status || '—'}</span></td>
                <td style={{ padding: 14 }}><button onClick={() => deleteOne(c.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{padding: 40, textAlign: 'center', color: '#94a3b8'}}>Nessun risultato</div>}
      </div>
    </div>
  );
}