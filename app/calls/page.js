"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export default function CallsPage() {
  const [tenant, setTenant] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    console.log("USER:", user);
    if (!user) {
      router.push('/login');
      return;
    }

    // Try get tenant
    let { data: tenantData, error: fetchError } = await supabase
     .from('tenants')
     .select('*')
     .eq('owner_id', user.id)
     .maybeSingle();

    console.log("TENANT FETCH:", tenantData, fetchError);

    // If not exists, create directly
    if (!tenantData) {
      console.log("Creating tenant for", user.id);
      const { data: newTenant, error: insertError } = await supabase
       .from('tenants')
       .insert({ owner_id: user.id, name: user.email.split('@')[0] })
       .select()
       .single();

      console.log("INSERT RESULT:", newTenant, insertError);

      if (insertError) {
        alert("Errore creazione tenant: " + insertError.message + " - Esegui in Supabase SQL: ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;");
        setLoading(false);
        return;
      }
      tenantData = newTenant;
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

  async function handleConnect() {
    window.location.href = `/api/auth/google?tenant_id=${tenant.id}`;
  }

  async function handleDisconnect() {
    if (!confirm('Disconnettere Google Calendar?')) return;
    await supabase.from('tenants').update({ google_refresh_token: null, calendar_id: null }).eq('id', tenant.id);
    window.location.reload();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <div style={{ padding: 40 }}>Caricamento... Controlla F12 Console</div>;
  if (!tenant) return <div style={{ padding: 40 }}>Errore tenant - apri F12 Console e mandami screenshot</div>;

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700' }}>Chiamate</h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{tenant?.name} • {tenant?.id.slice(0,8)}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {tenant?.google_refresh_token? (
            <>
              <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: '20px', fontSize: '14px' }}>✅ {tenant.calendar_id || 'primary'}</div>
              <button onClick={handleDisconnect} style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Disconnetti</button>
            </>
          ) : (
            <button onClick={handleConnect} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Collega Google Calendar</button>
          )}
          <button onClick={handleLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>Esci</button>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr><th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Data</th><th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Numero</th><th style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>Stato</th></tr>
          </thead>
          <tbody>
            {calls.length === 0? <tr><td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Nessuna chiamata - dashboard funzionante! ✅</td></tr> : calls.map(c => <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}><td style={{ padding: '12px 16px' }}>{new Date(c.created_at).toLocaleString()}</td><td style={{ padding: '12px 16px' }}>{c.from_number || '-'}</td><td style={{ padding: '12px 16px' }}>{c.status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}