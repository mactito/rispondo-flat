"use client";
import { useEffect, useState } from 'react';

export default function VapiWidget({ assistantId, tenantName }) {
  const [vapi, setVapi] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js";
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      const Vapi = window.Vapi;
      const instance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);
      setVapi(instance);
      instance.on("call-start", () => setIsCallActive(true));
      instance.on("call-end", () => setIsCallActive(false));
    };
    return () => { try { document.body.removeChild(script); } catch(e){} };
  }, []);

  const startCall = () => {
    if (!assistantId) { alert("AI non pronta, completa onboarding"); return; }
    if (vapi) vapi.start(assistantId);
  };

  return (
    <button onClick={startCall} style={{
      position:'fixed',bottom:24,right:24,background:isCallActive?'#ef4444':'black',
      color:'white',border:0,borderRadius:999,padding:'14px 22px',fontWeight:800,
      fontSize:14,boxShadow:'0 10px 30px rgba(0,0,0,0.25)',cursor:'pointer',zIndex:9999
    }}>
      {isCallActive? '🔴 In chiamata...' : `🤖 Chiama ${tenantName || 'AI'}`}
    </button>
  );
}