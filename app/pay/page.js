"use client";
export const dynamic = 'force-dynamic';

export default function Pay() {
  return (
    <div style={{minHeight:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f8fafc', fontFamily:'system-ui'}}>
      <div style={{width: 420, background: 'white', padding: 32, borderRadius: 20, border: '1px solid #e2e8f0', textAlign:'center'}}>
        <h1 style={{fontWeight: 900, fontSize: 24}}>Attiva Rispondo</h1>
        <p style={{color:'#64748b'}}>€149 setup + €49/mese. Prenotazioni illimitate.</p>
        <a href="https://buy.stripe.com/test_YOUR_LINK_HERE" style={{display:'block', marginTop:20, padding:14, borderRadius:12, background:'black', color:'white', textDecoration:'none', fontWeight:700}}>Paga con Carta →</a>
        <p style={{fontSize:12, color:'#94a3b8', marginTop:16}}>Dopo il pagamento, ti creiamo login in 2 minuti.</p>
      </div>
    </div>
  )
}