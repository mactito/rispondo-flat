"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CallsPage() {
  const [tenant, setTenant] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    init();
    if (typeof window!== 'undefined' && window.location.search.includes('connected=1')) {
      alert('✅ Google Calendar collegato!');
      window.history.replaceState({}, '', '/calls');
    }
    if (typeof window!== 'undefined' && window.location.search.includes('disconnected=1')) {
      window.history.replaceState({}, '', '/calls');
    }
  }, []);

  async function init() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    let { data: tenantData } = await supabase
     .from('tenants')
     .select('*')
     .eq('owner_id', user.id)
     .single();

    // If no tenant, create automatically via API (bypasses RLS, no manual ID needed)
    if (!tenantData) {
      try {
        const res = await fetch('/api/ensure-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email })
        });
        const newTenant = await res.json();
        if (!newTenant.error && newTenant.id) {
          tenantData = newTenant;
        }
      } catch (e) {
        console.error('ensure-tenant failed', e);
      }
    }

    if (!tenantData) {
      setLoading(false);
      return;
    }

    setTenant(tenantData);

    const { data: callsData } = await supabase
     .from('calls')
     .select('*')
     .eq('tenant_id', tenantData.id)
     .order('created_at', { ascending: false })
     .limit(100);

    setCalls(callsData || []);
    setLoading(false);
  }

  async function handleDisconnect() {
    if (!confirm('Disconnettere Google Calendar?')) return;
    const res = await fetch('/api/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id })
    });
    if (res.ok) window.location.reload();
    else alert('Errore durante disconnessione');
  }

  function handleConnect() {
    window.location.href = `/api/auth/google?tenant_id=${tenant.id}`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <div style={{ padding: 40 }}>Caricamento...</div>;

  if (!tenant) return <div style={{ padding: 40 }}>Creazione account... se resta bloccato ricarica dopo 5 sec.</div>;

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700' }}>Chiamate</h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{tenant?.name} • {tenant?.id.slice(0,8)}... </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {tenant?.google_refresh_token? (
            <>
              <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: '600' }}>
                ✅ {tenant.calendar_id || 'primary'}
              </div>
              <button onClick={handleDisconnect} style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                Disconnetti
              </button>
            </>
          ) : (
            <button onClick={handleConnect} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
              <img src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png" width="20" alt="gcal" />
              Collega Google Calendar
            </button>
          )}
          <button onClick={handleLogout} style={{ padding: '10px', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>Esci</button>
        </div>
      </div>

      {!tenant?.google_refresh_token && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
          ⚠ Collega Google Calendar per permettere all'AI di prenotare appuntamenti
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Data</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Numero</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Stato</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Durata</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Nessuna chiamata ancora</td></tr>
            ) : calls.map((call) => (
              <tr key={call.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{new Date(call.created_at).toLocaleString('it-IT')}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{call.from_number || call.phone || '-'}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>{call.status || 'completed'}</span></td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{call.duration_seconds? `${call.duration_seconds}s` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}