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
    try {
      console.log("Signing up...", email);
      // 1. SignUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password: pass });
      if(signUpError) throw signUpError;
      
      let userId = signUpData.user?.id;
      console.log("SignUp result userId:", userId);

      // 2. If no session (email confirmation on), login immediately
      if(!signUpData.session) {
        console.log("No session, trying signIn...");
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass });
        if(signInError) {
          // If email confirmation required, still continue with userId
          console.log("SignIn error (maybe email confirm):", signInError.message);
        } else {
          userId = signInData.user?.id || userId;
        }
      }

      if(!userId) throw new Error("User ID non trovato - controlla Supabase Auth settings > Disable email confirmation");

      // 3. Create tenant
      console.log("Calling /api/signup with", { userId, email, name });
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId, email, name })
      });
      const result = await res.json();
      console.log("API result:", result);
      if(!res.ok) throw new Error(result.error || "Errore API signup");

      // 4. SUCCESS - redirect
      console.log("SUCCESS, redirecting to /calls");
      window.location.href="/calls";
      
    } catch(err) {
      console.error(err);
      alert("Errore: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 400, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0'}}>
        <h1 style={{fontWeight: 900, fontSize: 26, margin:0}}>Crea Account Gratis</h1>
        <p style={{color:'#64748b', fontSize:14, marginTop:8}}>Già registrato? <a href="/login" style={{color:'black', fontWeight:700}}>Login</a></p>
        <input placeholder="Nome negozio" value={name} onChange={e=>setName(e.target.value)} style={{width:'100%', padding:14, marginTop:20, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%', padding:14, marginTop:12, borderRadius:12, border:'1px solid #e2e8f0'}}/>
        <button onClick={signup} disabled={loading} style={{width:'100%', padding:14, marginTop:16, borderRadius:12, background:'black', color:'white', fontWeight:700, border:0, cursor:'pointer'}}>
          {loading ? 'Creo...' : 'Crea Gratis →'}
        </button>
      </div>
    </div>
  )
}