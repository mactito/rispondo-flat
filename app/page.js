"use client";
import { useState } from "react";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fff', color: '#0f172a' }}>
      <style>{`
        @media (max-width: 768px){
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .hero-title { font-size: 38px !important; line-height: 0.95 !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -1 }}>RISPONDO<span style={{ color: '#22c55e' }}>.AI</span></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/login" style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13, textDecoration: 'none', color: '#0f172a' }}>Login</a>
          <a href="/signup" style={{ background: 'black', color: 'white', padding: '10px 18px', borderRadius: 999, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Prova Gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="grid-2" style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px 20px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 28, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: 11, padding: '6px 12px', borderRadius: 999, marginBottom: 16 }}>🟢 LIVE IN VENETO • 23 negozi attivi • Media 4.9/5</div>
          <h1 className="hero-title" style={{ fontSize: 56, fontWeight: 900, lineHeight: 0.9, letterSpacing: -3, margin: 0 }}>
            Non perdi<br/>più una<br/><span style={{ color: '#22c55e' }}>chiamata.</span>
          </h1>
          <p style={{ fontSize: 17, color: '#475569', marginTop: 18, lineHeight: 1.45, maxWidth: 480 }}>
            La tua AI risponde al telefono quando sei con cliente, prende appuntamenti, risponde su prezzi e staff. <b style={{ color: 'black' }}>Inoltro dopo 15 sec: se rispondi tu, parla tu.</b>
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="/signup" style={{ background: 'black', color: 'white', padding: '16px 28px', borderRadius: 12, fontWeight: 900, fontSize: 16, textDecoration: 'none', display: 'inline-block' }}>Attiva in 2 minuti →</a>
            <a href="#demo" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
              <span style={{ width: 36, height: 36, borderRadius: 999, background: '#f1f5f9', display: 'grid', placeItems: 'center', border: '1px solid #e2e8f0' }}>▶</span> Vedi chiamata vera
            </a>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
            <span>✓ Nessuna carta</span><span>✓ Disattivi con ##61#</span><span>✓ TIM/Vodafone/Iliad/Wind</span>
          </div>

          <div style={{ marginTop: 22, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>
              {[1,2,3].map(i => <div key={i} style={{ width: 32, height: 32, borderRadius: 999, background: `hsl(${i*30}, 70%, 85%)`, border: '2px solid white', marginLeft: i===1?0:-8 }} />)}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.2 }}><b>1,847 chiamate gestite</b><br/><span style={{ color: '#64748b' }}>ultimi 30 giorni in Veneto</span></div>
          </div>
        </div>

        {/* PHONE MOCK + VIDEO */}
        <div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 24, padding: 16, boxShadow: '0 20px 40px -20px rgba(0,0,0,0.15)' }}>
            <div style={{ background: 'black', borderRadius: 18, padding: 16, color: 'white', fontFamily: 'ui-monospace, monospace', fontSize: 12, minHeight: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#22c55e' }}>● Chiamata in corso • 00:47</span><span style={{ color: '#475569' }}>Salone Anna</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6 }}>
                <div style={{ color: '#94a3b8' }}>AI: Ciao, Salone Anna, sono l'assistente, come posso aiutarti?</div>
                <div style={{ marginTop: 10 }}>Cliente: Ciao, quanto costa taglio + piega e avete posto domani alle 3?</div>
                <div style={{ marginTop: 10, color: '#94a3b8' }}>AI: Taglio + piega 35€ con Anna, sì ho 15:00 e 16:30 liberi domani. Quale preferisci?</div>
                <div style={{ marginTop: 10 }}>Cliente: 15 va bene</div>
                <div style={{ marginTop: 10, color: '#22c55e' }}>✓ Prenotato: Dom 15:00 Anna - Taglio/Piega - Giulia 333...</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>+€1,240</div><div style={{ fontSize: 11, color: '#64748b' }}>Recuperato mese</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>0 perse</div><div style={{ fontSize: 11, color: '#64748b' }}>Chiamate perse oggi</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, background: '#fefce8', border: '1px dashed #eab308', borderRadius: 12, padding: '10px 12px', fontSize: 12 }}>
            <b>🎙️ Audio vero:</b> Ascolta chiamata gestita ieri a Montebelluna <span style={{ color: '#a16207', textDecoration: 'underline', cursor: 'pointer' }}>▶ Play 23 sec</span>
          </div>
        </div>
      </div>

      {/* VIDEO DEMO SECTION */}
      <div id="demo" style={{ background: 'black', color: 'white', marginTop: 36, padding: '56px 20px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 28, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', background: '#222', border: '1px solid #333', color: '#22c55e', fontWeight: 800, fontSize: 11, padding: '6px 10px', borderRadius: 999 }}>DEMO VIDEO • 37 SECONDI</div>
              <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.5, marginTop: 14, marginBottom: 0, lineHeight: 0.95 }}>Guarda come risponde mentre tu lavori</h2>
              <p style={{ color: '#94a3b8', marginTop: 14, fontSize: 15, lineHeight: 1.5 }}>Niente teoria. Un barbiere vero a Treviso ha attivato ieri. Questa è una chiamata persa recuperata.</p>
              <div style={{ marginTop: 18, display: 'grid', gap: 10, fontSize: 13 }}>
                <div>✅ Risponde in 2 squilli con nome negozio</div>
                <div>✅ Chiede nome, servizio, controlla disponibilità</div>
                <div>✅ Prenota + manda WhatsApp a te e cliente</div>
              </div>
              <a href="/signup" style={{ marginTop: 22, display: 'inline-block', background: 'white', color: 'black', padding: '14px 22px', borderRadius: 12, fontWeight: 900, textDecoration: 'none' }}>Prova con il tuo numero →</a>
            </div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 12, aspectRatio: '16/9', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Replace src with your Loom / YouTube embed later */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 999, background: 'white', color: 'black', display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto' }}>▶</div>
                <div style={{ marginTop: 12, fontWeight: 800 }}>Demo chiamata AI</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Clicca per vedere (sostituisci con tuo video Loom/YouTube)</div>
                <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>youtube.com/embed/TUO_VIDEO</div>
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', gap: 8 }}>
                <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>⏱ 00:00 / 00:37</div>
                <div style={{ background: '#22c55e', color: 'black', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800 }}>● LIVE</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ background: '#f8fafc', padding: '56px 20px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, textAlign: 'center', margin: 0 }}>Attivo in 2 minuti, senza tecnico</h2>
          <div className="grid-3" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { n: '1', t: 'Attiva inoltro', d: 'Componi **61*+39NUMEROVAPI*11*15# sul tuo cellulare. 10 sec, costo zero.' },
              { n: '2', t: 'Tu hai priorità', d: 'Se rispondi entro 15 sec, parli tu. Se sei con cliente, non rispondi → passa ad AI.' },
              { n: '3', t: 'AI prenota e avvisa', d: 'Controlla calendario, prenota, manda WhatsApp a te e al cliente. Impara ogni domenica.' },
            ].map(c => (
              <div key={c.n} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: 'black', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{c.n}</div>
                <div style={{ fontWeight: 800, marginTop: 12 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.4 }}>{c.d}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: '#64748b' }}>Compatibile con TIM, Vodafone, WindTre, Iliad, Fastweb • Disattivi quando vuoi con ##61#</div>
        </div>
      </div>

      {/* PRICING */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 20px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, textAlign: 'center', margin: 0 }}>Un prezzo, zero sbatti</h2>
        <div className="grid-3" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, maxWidth: 960, marginInline: 'auto' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
            <div style={{ fontWeight: 800 }}>Starter</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>€29<span style={{ fontSize: 16, fontWeight: 600 }}>/mese</span></div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 12, display: 'grid', gap: 6 }}><div>✓ 100 chiamate</div><div>✓ Prenotazioni auto</div><div>✓ Dashboard</div></div>
            <a href="/signup" style={{ display: 'block', marginTop: 20, textAlign: 'center', border: '1px solid #e2e8f0', padding: 12, borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: 'black' }}>Inizia</a>
          </div>
          <div style={{ border: '2px solid black', borderRadius: 20, padding: 24, background: 'black', color: 'white', transform: 'scale(1.03)' }}>
            <div style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}><span>Pro</span><span style={{ background: '#22c55e', color: 'black', fontSize: 11, padding: '2px 8px', borderRadius: 999 }}>PIÙ SCELTO</span></div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>€49<span style={{ fontSize: 16, fontWeight: 600 }}>/mese</span></div>
            <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 12, display: 'grid', gap: 6 }}><div>✓ Illimitate</div><div>✓ AI impara ogni domenica</div><div>✓ WhatsApp cliente</div><div>✓ Info extra negozio</div></div>
            <a href="/signup" style={{ display: 'block', marginTop: 20, textAlign: 'center', background: 'white', color: 'black', padding: 12, borderRadius: 12, fontWeight: 800, textDecoration: 'none' }}>Prova 7gg Gratis</a>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
            <div style={{ fontWeight: 800 }}>Multi-sede</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>€99<span style={{ fontSize: 16, fontWeight: 600 }}>/mese</span></div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 12, display: 'grid', gap: 6 }}><div>✓ Tutto Pro</div><div>✓ 3 sedi</div><div>✓ Supporto telefonico</div></div>
            <a href="/signup" style={{ display: 'block', marginTop: 20, textAlign: 'center', border: '1px solid #e2e8f0', padding: 12, borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: 'black' }}>Contattaci</a>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '10px 20px 80px' }}>
        <h3 style={{ fontWeight: 900, fontSize: 20 }}>Domande</h3>
        {[
          { q: 'Devo cambiare numero o operatore?', a: 'No. Tieni tutto. Attivi solo inoltro di chiamata dopo 15 secondi. 10 secondi, gratis.' },
          { q: 'Se un cliente chiama e io rispondo?', a: 'Parli tu. L AI non interviene. Interviene solo se non rispondi entro 15 sec.' },
          { q: 'Come disattivo?', a: 'Componi ##61# sul tuo telefono. Torna normale in 2 secondi.' },
          { q: 'L AI sa i miei prezzi?', a: 'Sì, li scrivi nel box giallo in onboarding. In più impara ogni domenica dalle chiamate reali.' },
        ].map((f, i) => (
          <div key={i} style={{ borderBottom: '1px solid #e2e8f0', padding: '14px 0' }}>
            <div onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>{f.q} <span>{openFaq === i ? '−' : '+'}</span></div>
            {openFaq === i && <div style={{ fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>{f.a}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: 'black', color: 'white', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>Pronto a non perdere più clienti?</div>
        <a href="/signup" style={{ marginTop: 16, display: 'inline-block', background: 'white', color: 'black', padding: '14px 28px', borderRadius: 12, fontWeight: 900, textDecoration: 'none' }}>Attiva Rispondo gratis →</a>
        <div style={{ marginTop: 18, fontSize: 11, color: '#64748b' }}>Rispondo.ai © 2025 - Crocetta del Montello (TV) - support@rispondo.ai - P.IVA in richiesta</div>
      </div>
    </div>
  );
}