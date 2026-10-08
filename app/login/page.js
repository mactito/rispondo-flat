"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { createClient } from '@supabase/supabase-js';

export default function Login() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = useState(""); 
  const [pass, setPass] = useState(""); 
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if(!email||!pass){alert("Compila tutto"); return;} 
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if(error) throw error;
      
      const userId = data.user.id;
      
      // Check profile -> tenant -> onboarding status
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', userId).maybeSingle();
      
      if(!profile?.tenant_id){
        // No tenant yet - try to find by owner_id
        const { data: tenantByOwner } = await supabase.from('tenants').select('id, onboarding_completed').eq('owner_id', userId).maybeSingle();
        if(!tenantByOwner){
          window.location.href="/onboarding";
          return;
        }
        if(!tenantByOwner.onboarding_completed){
          window.location.href="/onboarding";
        } else {
          window.location.href="/calls";
        }
        return;
      }

      const { data: tenant } = await supabase.from('tenants').select('onboarding_completed').eq('id', profile.tenant_id).maybeSingle();
      
      if(!tenant || !tenant.onboarding_completed){
        window.location.href="/onboarding";
      } else {
        window.location.href="/calls";
      }
      
    } catch(err) {
      console.error(err);
      alert("Errore login: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 400, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Accedi</h1>
        <p style={{color:'#64748b', fontSize:14, marginTop:8}}>Non hai account? <a href="/signup" style={{color:'black', fontWeight:700}}>Registrati</a></p>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <button onClick={login} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0, cursor:'pointer'}}>
          {loading ? 'Entro...' : 'Accedi →'}
        </button>
      </div>
    </div>
  )
}