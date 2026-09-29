"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  const login = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if(error) { alert(error.message); setLoading(false); }
    else { 
      // Force hard reload so middleware sees the cookie
      window.location.href = "/calls";
      window.location.reload();
    }
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 380, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Rispondo</h1>
        <p style={{color:'#64748b', marginTop:6}}>Accedi al tuo salone</p>
        <input placeholder="Email negozio" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <button onClick={login} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0, cursor:'pointer'}}>
          {loading? 'Accesso...' : 'Entra →'}
        </button>
      </div>
    </div>
  )
}