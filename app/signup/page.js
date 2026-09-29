"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [debug, setDebug] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/signup"; return; }
      
      // Try profile
      let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // AUTO-REPAIR: if no profile, find tenant by email and create profile (auto)
      if(!profile){
        const { data: tenantByEmail } = await supabase.from('tenants').select('*').eq('email', user.email).order('created_at',{ascending:false}).limit(1).single();
        if(tenantByEmail){
          await supabase.from('profiles').insert({ id: user.id, email: user.email, tenant_id: tenantByEmail.id, is_paid: true });
          profile = { tenant_id: tenantByEmail.id };
        }
      }

      if (!profile?.tenant_id) { setLoading(false); return; }
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single();
      setTenant(tenantData);
      const { data: callsData } = await supabase.from('calls').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false });
      setCalls(callsData || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{padding:32}}>Loading...</div>;

  return (
    <div style={{minHeight:'100vh', background:'#f8fafc', padding:24, fontFamily:'system-ui'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>
        <h1 style={{fontWeight:900, fontSize:28}}>{tenant?.name} - Dashboard</h1>
        <div style={{marginTop:16, fontSize:12, fontFamily:'monospace', background:'black', color:'#22c55e', padding:12, borderRadius:12, wordBreak:'break-all'}}>
          TENANT_ID: {tenant?.id}<br/>
          VAPI URL: https://rispondo-flat-g7ns.vercel.app/api/book?tenant_id={tenant?.id}
        </div>
        <div style={{background:'white', border:'1px solid #e2e8f0', borderRadius:16, marginTop:16, overflow:'hidden'}}>
          <div style={{padding:16, fontWeight:700}}>Prenotazioni ({calls.length})</div>
          {calls.length===0? <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>Nessuna prenotazione</div> :
            <table style={{width:'100%', fontSize:14}}><tbody>{calls.map(c=><tr key={c.id}><td style={{padding:12}}>{c.caller_name} - {c.service_booked}</td></tr>)}</tbody></table>}
        </div>
      </div>
    </div>
  );
}