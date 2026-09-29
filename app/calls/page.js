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
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    async function load() {
      // 1. Check logged in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/signup";
        return;
      }
      setUserEmail(user.email);

      // 2. Get his profile -> tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        alert("Nessun negozio trovato per questo account");
        setLoading(false);
        return;
      }

      // 3. Get tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single();
      
      setTenant(tenantData);

      // 4. Get calls for HIS tenant only
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

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/signup";
  };

  if (loading) return <div style={{padding:32}}>Caricamento dashboard...</div>;

  return (
    <div style={{minHeight:'100vh', background:'#f8fafc', padding:24, fontFamily:'system-ui'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
          <div>
            <h1 style={{fontWeight:900, fontSize:28, margin:0}}>{tenant?.name || 'Dashboard'}</h1>
            <p style={{fontSize:13, color:'#64748b', margin:'4px 0 0 0'}}>{userEmail} • Tenant: {tenant?.id?.slice(0,8)}...</p>
          </div>
          <button onClick={logout} style={{padding:'8px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:'white'}}>Logout</button>
        </div>

        <div style={{background:'white', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden'}}>
          <div style={{padding:'16px 20px', borderBottom:'1px solid #e2e8f0', fontWeight:700}}>
            Prenotazioni ({calls.length})
          </div>
          {calls.length === 0 ? (
            <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>
              Nessuna prenotazione ancora.<br/>
              <span style={{fontSize:12}}>Testa chiamando il tuo numero +39</span>
            </div>
          ) : (
            <table style={{width:'100%', fontSize:14, borderCollapse:'collapse'}}>
              <thead style={{background:'#f8fafc', textAlign:'left'}}>
                <tr>
                  <th style={{padding:12}}>Cliente</th>
                  <th style={{padding:12}}>Telefono</th>
                  <th style={{padding:12}}>Servizio</th>
                  <th style={{padding:12}}>Data</th>
                </tr>
              </thead>
              <tbody>
                {calls.map(c=>(
                  <tr key={c.id} style={{borderTop:'1px solid #f1f5f9'}}>
                    <td style={{padding:12, fontWeight:600}}>{c.caller_name}</td>
                    <td style={{padding:12}}>{c.from_number}</td>
                    <td style={{padding:12}}>{c.service_booked}</td>
                    <td style={{padding:12}}>{new Date(c.booking_time).toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{marginTop:16, fontSize:12, color:'#94a3b8'}}>
          Server URL per Vapi: <code style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:6}}>https://rispondo-flat-g7ns.vercel.app/api/book?tenant_id={tenant?.id}</code>
        </div>
      </div>
    </div>
  );
}