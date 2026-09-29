"use client";
import { useEffect, useState, useMemo } from "react";

export default function CallsDashboard() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadCalls = () => {
    fetch("/api/calls")
      .then(r => r.json())
      .then(data => {
        setCalls(data);
        setLoading(false);
      });
  };

  useEffect(() => { loadCalls(); }, []);

  const exportCSV = () => {
    const headers = ["Cliente","Telefono","Servizio","Data","Stato"];
    const rows = filteredCalls.map(c => [
      c.caller_name || c.customer_name || "",
      c.from_number || c.customer_phone || "",
      c.service_booked || c.service_name || "",
      c.booking_time || c.created_at || "",
      c.status || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rispondo-prenotazioni-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const deleteOne = async (id) => {
    if (!confirm("Eliminare questa prenotazione?")) return;
    await fetch(`/api/calls?id=${id}`, { method: 'DELETE' });
    loadCalls();
  };

  const deleteTestData = async () => {
    if (!confirm("Eliminare tutti i test con tenant_id NULL?")) return;
    await fetch(`/api/calls?test=true`, { method: 'DELETE' });
    loadCalls();
  };

  const filteredCalls = useMemo(() => {
    let result = [...calls];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => 
        (c.caller_name || c.customer_name || "").toLowerCase().includes(s) ||
        (c.from_number || c.customer_phone || "").includes(s) ||
        (c.service_booked || c.service_name || "").toLowerCase().includes(s)
      );
    }
    if (statusFilter !== "all") result = result.filter(c => c.status === statusFilter);
    if (dateFilter !== "all") {
      const now = new Date();
      result = result.filter(c => {
        const d = new Date(c.booking_time || c.created_at);
        if (dateFilter === "today") return d.toDateString() === now.toDateString();
        if (dateFilter === "week") { const w = new Date(); w.setDate(now.getDate() - 7); return d >= w; }
        if (dateFilter === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return true;
      });
    }
    return result;
  }, [calls, search, statusFilter, dateFilter]);

  if (loading) return <div style={{padding: 40}}>Loading...</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>📞 Rispondo — Prenotazioni</h1>
          <p style={{ color: '#64748b', marginBottom: 0 }}>{filteredCalls.length} di {calls.length} prenotazioni</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 18px', borderRadius: 10, background: 'black', color: 'white', border: 0, fontWeight: 600, cursor: 'pointer' }}>⬇️ Export CSV</button>
          <button onClick={deleteTestData} style={{ padding: '10px 18px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600, cursor: 'pointer' }}>🗑️ Pulisci Test</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '20px 0', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Cerca nome, telefono, servizio..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 280px', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white' }} />
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white' }}>
          <option value="all">Tutte le date</option><option value="today">Oggi</option><option value="week">Ultimi 7 giorni</option><option value="month">Questo mese</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white' }}>
          <option value="all">Tutti gli stati</option><option value="booked">Booked</option><option value="cancelled">Cancelled</option><option value="no_answer">No Answer</option>
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead style={{ background: '#f8fafc', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>
              <tr><th style={{ padding: '14px 20px' }}>Cliente</th><th style={{ padding: '14px 20px' }}>Telefono</th><th style={{ padding: '14px 20px' }}>Servizio</th><th style={{ padding: '14px 20px' }}>Data/Ora</th><th style={{ padding: '14px 20px' }}>Stato</th><th style={{ padding: '14px 20px' }}></th></tr>
            </thead>
            <tbody>
              {filteredCalls.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9', background: !c.tenant_id ? '#fffbeb' : 'white' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{c.caller_name || c.customer_name || '—'} {!c.tenant_id && <span style={{fontSize: 10, background: '#fde68a', padding: '2px 6px', borderRadius: 10, marginLeft: 6}}>TEST</span>}</td>
                  <td style={{ padding: '16px 20px' }}>{c.from_number || c.customer_phone || '—'}</td>
                  <td style={{ padding: '16px 20px' }}><span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 20, fontSize: 13 }}>{c.service_booked || c.service_name || '—'}</span></td>
                  <td style={{ padding: '16px 20px', color: '#475569' }}>{new Date(c.booking_time || c.created_at).toLocaleString('it-IT', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</td>
                  <td style={{ padding: '16px 20px' }}><span style={{ background: c.status === 'booked' ? '#dcfce7' : '#fef3c7', color: c.status === 'booked' ? '#166534' : '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{c.status || '—'}</span></td>
                  <td style={{ padding: '16px 20px' }}><button onClick={() => deleteOne(c.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18 }}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCalls.length === 0 && <div style={{padding: 40, textAlign: 'center', color: '#94a3b8'}}>Nessun risultato</div>}
      </div>
    </div>
  );
}