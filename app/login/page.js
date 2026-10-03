"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { createClient } from '@supabase/supabase-js';

export default function Login() {
  const [email, setEmail] = useState(""); 
  const [pass, setPass] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"); // login | signup

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleAuth = async () => {
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert(error.message);
      else window.location.href = "/calls";
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: pass });
      if (error) alert(error.message);
      else {
        alert("Account creato! Ora puoi accedere. Controlla anche l'email per conferma se richiesta.");
        setMode("login");
      }
    }
    setLoading(false);
  };
  
  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 380, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Rispondo</h1>
        <p style={{color:'#64748b', fontSize:14, marginTop:6}}>
          {mode === "login" ? "Accedi al tuo account" : "Crea un nuovo account"}
        </p>

        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        
        <button onClick={handleAuth} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0, cursor:'pointer'}}>
          {loading ? '...' : mode === "login" ? 'Entra →' : 'Registrati →'}
        </button>

        <div style={{textAlign:'center', marginTop:16, fontSize:14}}>
          {mode === "login" ? (
            <span>Non hai account? <button onClick={()=>setMode("signup")} style={{background:'none', border:'none', color:'black', fontWeight:700, cursor:'pointer', textDecoration:'underline'}}>Registrati</button></span>
          ) : (
            <span>Hai già un account? <button onClick={()=>setMode("login")} style={{background:'none', border:'none', color:'black', fontWeight:700, cursor:'pointer', textDecoration:'underline'}}>Accedi</button></span>
          )}
        </div>
      </div>
    </div>
  )
}