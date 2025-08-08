import React, { useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_SIGNALING_URL || 'http://10.28.159.141:5001').replace(/\/$/, '');

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('authToken', data.token);
      window.location.assign('/live');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-gray-100 p-4">
      <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4 text-sky-400">Sign in</h1>
        <label className="block text-sm mb-1">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full mb-3 px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none" />
        <label className="block text-sm mb-1">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full mb-4 px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none" />
        {error && <div className="mb-3 text-rose-300 text-sm">{error}</div>}
        <button disabled={loading} className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded text-white disabled:opacity-60">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
