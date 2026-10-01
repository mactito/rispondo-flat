"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/signup"; return; }

      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        const { data: latestTenant } = await supabase
          .from('tenants')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latestTenant) {
          await supabase.from('profiles').insert({ 
            id: user.id, 
            email: user.email, 
            tenant_id: latestTenant.id, 
            is_paid: true 
          });
          profile = { tenant_id: latestTenant.id };
        }
      }

      if (!profile?.tenant_id) { 
        setLoading(false); 
        return; 
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single();
      
      setTenant(tenantData);

      const { data: callsData } = await supabase
        .from('calls')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });
      
      setCalls(callsData || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 32, fontFamily: 'monospace' }}>Loading dashboard...</div>;
  }

  if (!tenant) {
    return <div style={{ padding: 32 }}>Nessun negozio trovato. Vai su /signup</div>;
  }

  const isConnected = !!tenant.google_refresh_token;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>
          {tenant.business_name} - Dashboard
        </h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>
          {tenant.city || 'Comacchio'} • {tenant.category || 'salone'} • {tenant.owner_email}
        </p>

        {/* VAPI URL BOX */}
        <div style={{ 
          marginTop: 16, 
          fontSize: 12, 
          fontFamily: 'monospace', 
          background: 'black', 
          color: '#22c55e', 
          padding: 12, 
          borderRadius: 12, 
          wordBreak: 'break-all',
          lineHeight: '18px'
        }}>
          <div>TENANT_ID: {tenant.id}</div>
          <div>VAPI Assistant: {tenant.vapi_assistant_id || 'Creazione in corso...'}</div>
          <div style={{ marginTop: 8, color: 'white' }}>
            Server URL per Vapi:<br/>
            https://rispondo-flat-g7ns.vercel.app/api/book?tenant_id={tenant.id}
          </div>
          <div style={{ marginTop: 8, color: '#94a3b8' }}>
            Check URL per Vapi:<br/>
            https://rispondo-flat-g7ns.vercel.app/api/check-availability?tenant_id={tenant.id}
          </div>
        </div>

        {/* GOOGLE CONNECT BUTTON */}
        <div style={{ marginTop: 16 }}>
          {isConnected ? (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span> Google Calendar collegato: {tenant.calendar_id}
            </div>
          ) : (
            <a
              href={`/api/auth/google?tenant_id=${tenant.id}`}
              style={{
                display: 'inline-block',
                background: '#4285F4',
                color: 'white',
                padding: '12px 20px',
                borderRadius: 12,
                fontWeight: 800,
                textDecoration: 'none',
                fontSize: 14
              }}
            >
              🔗 Collega Google Calendar - Collega il tuo calendario
            </a>
          )}
        </div>

        {/* BOOKINGS TABLE */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: 16, 
          marginTop: 16, 
          overflow: 'hidden' 
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
            Prenotazioni ({calls.length})
          </div>
          
          {calls.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Nessuna prenotazione ancora.<br/>
              <span style={{ fontSize: 12 }}>Le chiamate Vapi appariranno qui automaticamente</span>
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: 12 }}>Cliente</th>
                  <th style={{ padding: 12 }}>Telefono</th>
                  <th style={{ padding: 12 }}>Servizio</th>
                  <th style={{ padding: 12 }}>Data</th>
                  <th style={{ padding: 12 }}>Stato</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{c.caller_name}</td>
                    <td style={{ padding: 12 }}>{c.from_number}</td>
                    <td style={{ padding: 12 }}>{c.service_booked}</td>
                    <td style={{ padding: 12 }}>
                      {c.booking_time ? new Date(c.booking_time).toLocaleString('it-IT') : '-'}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
                        {c.status || 'confirmed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button 
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
            style={{ fontSize: 13, color: '#64748b', background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}