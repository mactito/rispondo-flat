"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CallsPage() {
  const [tenant, setTenant] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === '1') {
      alert('✅ Google Calendar connesso con successo!');
      window.history.replaceState({}, '', '/calls');
    }

    async function loadData() {
      setLoading(true);
      // Get tenant - change this query if you filter by user
      const { data: tenantData, error } = await supabase
        .from('tenants')
        .select('*')
        .limit(1)
        .single();

      if (error) console.error(error);
      setTenant(tenantData);

      if (tenantData) {
        const { data: callsData } = await supabase
          .from('calls')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false });
        setCalls(callsData || []);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const connectGoogle = () => {
    if (!tenant) return alert("Tenant non trovato");
    window.location.href = `/api/auth/google?tenant_id=${tenant.id}`;
  };

  if (loading) return <div style={{ padding: 40 }}>Caricamento...</div>;

  return (
    <div style={{ fontFamily: 'system-ui', padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>Dashboard Chiamate</h1>
        
        {tenant?.google_refresh_token ? (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: '20px', fontSize: '14px' }}>
            ✅ Calendar: {tenant.calendar_id}
          </div>
        ) : (
          <button 
            onClick={connectGoogle}
            style={{ 
              background: '#4285f4', 
              color: 'white', 
              padding: '12px 20px', 
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Connect Google Calendar
          </button>
        )}
      </div>

      {!tenant?.google_refresh_token && (
        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          ⚠️ Collega Google Calendar per permettere all'AI di prenotare appuntamenti
        </div>
      )}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '12px' }}>Data</th>
              <th style={{ padding: '12px' }}>Cliente</th>
              <th style={{ padding: '12px' }}>Stato</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Nessuna chiamata ancora</td></tr>
            ) : (
              calls.map((call) => (
                <tr key={call.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{new Date(call.created_at).toLocaleString('it-IT')}</td>
                  <td style={{ padding: '12px' }}>{call.customer_phone || call.customer_name || '-'}</td>
                  <td style={{ padding: '12px' }}>{call.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}