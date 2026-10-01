'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('Comacchio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          business_name: businessName,
          city: city
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      router.push('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Crea il tuo negozio</h1>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm">{error}</div>}
        <input className="w-full border p-3 rounded" placeholder="Nome negozio es. Salone Luca" value={businessName} onChange={e=>setBusinessName(e.target.value)} required />
        <input className="w-full border p-3 rounded" placeholder="Città" value={city} onChange={e=>setCity(e.target.value)} required />
        <input className="w-full border p-3 rounded" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="w-full border p-3 rounded" type="password" placeholder="Password (min 6 caratteri)" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
        <button disabled={loading} className="w-full bg-black text-white p-3 rounded font-semibold">{loading ? 'Creo...' : 'Crea negozio'}</button>
      </form>
    </div>
  );
}