"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { createClient } from '@supabase/supabase-js';

export default function Signup() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = useState(""); 
  const [pass, setPass] = useState(""); 
  const [name, setName] = useState(""); 
  const [loading, setLoading] = useState(false);
  
  const signup = async () => {
    if(!email||!pass||!name){alert("Compila tutto"); return;} 
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if(error){ alert(error.message); setLoading(false); return; }
    if(data.user){
      const { data: tenant } = await supabase.from('tenants').insert({ 
        name: name, 
        email: email, 
        owner_id: data.user.id 
      }).select().single();
      if(tenant) await supabase.from('profiles').insert({ 
        id: data.user.id, 
        email, 
        tenant_id: tenant.id, 
        is_paid: true 
      });
      window.location.href="/calls";
    }
    setLoading(false);
  };
  
  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 400, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Crea Account Gratis</h1>
        <input placeholder="Nome negozio" value={name} onChange={e=>setName(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <button onClick={signup} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0}}>
          {loading ? 'Creo...' : 'Crea Gratis →'}
        </button>
      </div>
    </div>
  )
}