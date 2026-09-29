"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    if(!email || !pass || !name) { alert("Compila tutti i campi"); return; }
    setLoading(true);
    
    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password: pass,
      options: { data: { shop_name: name } }
    });
    
    if(error) { 
      alert(error.message); 
      setLoading(false); 
      return; 
    }

    // 2. Create tenant for them
    if(data.user) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name: name })
        .select()
        .single();

      if(!tenantError && tenant) {
        // 3. Create profile linking user -> tenant
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: email,
          tenant_id: tenant.id,
          is_paid: false // They will pay after
        });
      }
      
      alert("Account creato! Controlla email per confermare, poi vai al pagamento.");
      window.location.href = "/pay";
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 380, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Crea Account</h1>
        <p style={{color:'#64748b', marginTop:6}}>Registra il tuo salone su Rispondo</p>
        
        <input placeholder="Nome negozio es. Barber King Rimini" value={name} onChange={e=>setName(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Email negozio" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password (min 6)" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        
        <button onClick={signup} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0, cursor:'pointer'}}>
          {loading? 'Creazione...' : 'Crea Account →'}
        </button>
        
        <p style={{fontSize:13, color:'#64748b', marginTop:16, textAlign:'center'}}>
          Hai già account? <a href="/login" style={{color:'black', fontWeight:700}}>Accedi</a>
        </p>
      </div>
    </div>
  )
}