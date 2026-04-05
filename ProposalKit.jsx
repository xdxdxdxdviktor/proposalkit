import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';
import { proposalsService } from './proposalsService.js';

// --- STYLES ---
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{
    __html: `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap');
    
    .font-serif { font-family: 'DM Serif Display', serif; }
    .font-sans { font-family: 'DM Sans', sans-serif; }
    
    .bg-texture {
      background-color: #faf8f4;
      background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%230f0e0d' fill-opacity='0.02' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3C/g%3E%3C/svg%3E");
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-up { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin-slow { animation: spin-slow 1s linear infinite; }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .animate-pulse-dot { animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(15, 14, 13, 0.15); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(15, 14, 13, 0.25); }

    .bottom-nav {
      padding-bottom: env(safe-area-inset-bottom);
    }
  `}} />
);

// --- UTILS ---
const safeStorage = {
  getItem: (key) => {
    try { return window.localStorage.getItem(key); }
    catch (e) { try { return window.sessionStorage.getItem(key); } catch (err) { return null; } }
  },
  setItem: (key, value) => {
    try { window.localStorage.setItem(key, value); }
    catch (e) { try { window.sessionStorage.setItem(key, value); } catch (err) { } }
  },
  removeItem: (key) => {
    try { window.localStorage.removeItem(key); }
    catch (e) { try { window.sessionStorage.removeItem(key); } catch (err) { } }
  }
};

function useSafeState(key, initialValue) {
  const [state, setState] = useState(() => {
    const item = safeStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });
  useEffect(() => {
    safeStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

const fmt = (value, currency = 'CZK') => {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const totalOf = (proposal) => {
  if (!proposal || !proposal.services) return 0;
  return proposal.services.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
};

const genId = () => Math.random().toString(36).substring(2, 9);
const genSlug = (title) => (title || 'nabidka').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') + '-' + genId();
const formatDate = (isoStr) => isoStr ? new Date(isoStr).toLocaleDateString('cs-CZ') : '';

// --- UI COMPONENTS ---
const Button = ({ children, variant = 'primary', className = '', loading, icon, ...props }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg shadow-sm hover:-translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#0f0e0d] text-[#faf8f4] hover:bg-[#2a2825]",
    accent: "bg-[#c8553d] text-white hover:bg-[#b04a35]",
    outline: "bg-transparent border border-[#0f0e0d]/20 text-[#0f0e0d] hover:bg-[#0f0e0d]/5",
    dangerOutline: "bg-transparent border border-red-500 text-red-600 hover:bg-red-50",
    ghost: "bg-transparent text-[#0f0e0d] hover:bg-[#0f0e0d]/5 shadow-none"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading ? <span className="mr-2 inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow" /> : icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

const Input = ({ label, className = '', ...props }) => (
  <div className={`flex flex-col mb-4 ${className}`}>
    {label && <label className="mb-1.5 text-sm font-medium text-[#0f0e0d]/80">{label}</label>}
    <input
      className="w-full px-3 py-2.5 border border-[#0f0e0d]/15 rounded-lg focus:outline-none focus:border-[#c8553d] focus:ring-1 focus:ring-[#c8553d] bg-white text-[#0f0e0d] text-sm transition-shadow shadow-sm placeholder:text-[#0f0e0d]/30"
      {...props}
    />
  </div>
);

const Textarea = ({ label, className = '', ...props }) => (
  <div className={`flex flex-col mb-4 ${className}`}>
    {label && <label className="mb-1.5 text-sm font-medium text-[#0f0e0d]/80">{label}</label>}
    <textarea
      className="w-full px-3 py-2.5 border border-[#0f0e0d]/15 rounded-lg focus:outline-none focus:border-[#c8553d] focus:ring-1 focus:ring-[#c8553d] bg-white text-[#0f0e0d] text-sm transition-shadow min-h-[120px] shadow-sm resize-y"
      {...props}
    />
  </div>
);

const Select = ({ label, options, className = '', ...props }) => (
  <div className={`flex flex-col mb-4 ${className}`}>
    {label && <label className="mb-1.5 text-sm font-medium text-[#0f0e0d]/80">{label}</label>}
    <select
      className="w-full px-3 py-2.5 border border-[#0f0e0d]/15 rounded-lg focus:outline-none focus:border-[#c8553d] focus:ring-1 focus:ring-[#c8553d] bg-white text-[#0f0e0d] text-sm transition-shadow shadow-sm cursor-pointer appearance-none"
      {...props}
    >
      {options.map(opt => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}
    </select>
  </div>
);

const Badge = ({ status }) => {
  const map = {
    draft: { bg: 'bg-[#0f0e0d]/10', text: 'text-[#0f0e0d]', label: 'Koncept' },
    sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Odesláno' },
    accepted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Přijato' },
    declined: { bg: 'bg-red-100', text: 'text-red-700', label: 'Odmítnuto' }
  };
  const current = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
};

// --- VIEWS ---

const LandingPage = ({ onStart }) => (
  <div className="min-h-screen flex flex-col font-sans animate-fade-up">
    <header className="px-6 md:px-12 py-5 flex items-center justify-between sticky top-0 bg-[#faf8f4]/90 backdrop-blur-md z-40 border-b border-[#0f0e0d]/5">
      <div className="font-serif text-2xl text-[#c8553d] tracking-normal">ProposalKit.</div>
      <div className="space-x-2">
        <Button variant="ghost" className="text-sm px-3 py-2" onClick={onStart}>Přihlásit se</Button>
        <Button variant="primary" className="text-sm px-3 py-2" onClick={onStart}>Začít zdarma</Button>
      </div>
    </header>

    <main className="flex-1 flex flex-col items-center justify-center pt-16 pb-24 px-6 text-center">
      <div className="inline-flex items-center space-x-2 bg-white px-4 py-1.5 rounded-full shadow-sm border border-[#0f0e0d]/5 text-sm mb-8">
        <span className="w-2 h-2 rounded-full bg-[#c8553d] animate-pulse-dot" />
        <span className="font-medium text-[#0f0e0d]/70 text-xs md:text-sm">Nová generace nástrojů pro freelancery</span>
      </div>

      <h1 className="font-serif text-4xl md:text-7xl max-w-4xl text-[#0f0e0d] leading-[1.1] mb-6">
        Profesionální nabídky, <br />
        <span className="text-[#c8553d] italic">které vyhrávají klienty.</span>
      </h1>

      <p className="text-base md:text-xl text-[#0f0e0d]/60 max-w-2xl mb-10">
        Vytvářejte krásné a přehledné cenové nabídky v řádu sekund. S podporou AI a bez zbytečné administrativy.
      </p>

      <Button variant="accent" className="text-base px-8 py-4 rounded-xl shadow-md hover:shadow-lg w-full max-w-xs" onClick={onStart}>
        Vytvořit první nabídku
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-5xl w-full">
        {[
          { icon: '✨', title: 'AI asistent', desc: 'Nechte umělou inteligenci napsat profesionální úvod za vás.' },
          { icon: '🔗', title: 'Sdílení odkazem', desc: 'Rozlučte se s těžkopádnými PDF. Pošlete klientovi elegantní odkaz.' },
          { icon: '✅', title: 'Přijetí jedním klikem', desc: 'Klienti mohou nabídku přijmout přímo v prohlížeči.' },
          { icon: '📊', title: 'Přehled nabídek', desc: 'Sledujte stav všech svých nabídek na jednom místě.' },
          { icon: '📄', title: 'Export PDF', desc: 'Jednoduše vytiskněte nebo uložte vytvořené nabídky jako PDF.' },
          { icon: '💼', title: 'Profil freelancera', desc: 'Uložte si své údaje a zrychlete tvorbu dalších dokumentů.' }
        ].map(feat => (
          <div key={feat.title} className="bg-white p-5 rounded-2xl shadow-sm border border-[#0f0e0d]/5 text-left hover:-translate-y-1 transition-transform">
            <div className="text-2xl mb-3">{feat.icon}</div>
            <h3 className="font-serif text-lg mb-1 text-[#0f0e0d]">{feat.title}</h3>
            <p className="text-sm text-[#0f0e0d]/60 leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </main>

    <div className="bg-[#0f0e0d] py-14 text-center px-6">
      <h2 className="font-serif text-2xl md:text-4xl text-[#faf8f4] mb-6">Připraveni získat dalšího klienta?</h2>
      <Button variant="accent" className="px-6 py-3 w-full max-w-xs" onClick={onStart}>Začněte používat ProposalKit</Button>
    </div>

    <footer className="py-8 text-center text-sm text-[#0f0e0d]/40">
      © {new Date().getFullYear()} ProposalKit. Vytvořeno pro nezávislé profesionály.
    </footer>
  </div>
);

const AuthModal = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!email || !password) { setError('Vyplňte email a heslo.'); return; }
    setLoading(true);
    setError('');

    const { data, error: err } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (err) { setError(err.message); return; }

    if (!isLogin && !data.session) {
      setError('');
      alert('Zkontrolujte email a potvrďte registraci.');
      return;
    }

    onLogin(data.user);
  };

  return (
    <div className="fixed inset-0 bg-[#0f0e0d]/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white p-8 rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-sm relative animate-fade-up border border-[#0f0e0d]/10">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#0f0e0d]/40 hover:text-[#0f0e0d] p-2">✕</button>
        <h2 className="font-serif text-2xl text-[#0f0e0d] mb-2">{isLogin ? 'Vítejte zpět' : 'Nová registrace'}</h2>
        <p className="text-sm text-[#0f0e0d]/60 mb-6">Zadejte své údaje a pokračujte dále.</p>

        <div onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}>
          <Input label="Email" type="email" placeholder="vas@email.cz" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Heslo" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs mb-4 border border-red-100">
              {error}
            </div>
          )}

          <Button variant="primary" className="w-full mb-4 py-3" loading={loading} onClick={handleSubmit}>
            {isLogin ? 'Přihlásit se' : 'Zaregistrovat se'}
          </Button>
        </div>

        <div className="text-center text-sm text-[#0f0e0d]/60 pb-2">
          {isLogin ? 'Nemáte účet? ' : 'Už máte účet? '}
          <button className="text-[#c8553d] font-medium hover:underline" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Zaregistrujte se' : 'Přihlaste se'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Layout = ({ user, currentRoute, navigate, onLogout, children }) => {
  const navItems = [
    { id: 'dashboard', label: 'Přehled', icon: '📊' },
    { id: 'editor', label: 'Nová', icon: '✨' },
    { id: 'profile', label: 'Profil', icon: '👤' }
  ];

  return (
    <div className="flex min-h-screen">

      {/* DESKTOP sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0f0e0d] text-[#faf8f4] flex-col fixed inset-y-0 shadow-xl z-30">
        <div className="p-6">
          <div className="font-serif text-2xl text-[#c8553d] tracking-wide cursor-pointer" onClick={() => navigate('dashboard')}>
            ProposalKit
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full text-left flex items-center px-4 py-3 rounded-xl transition-all ${currentRoute === item.id ? 'bg-[#2a2825] text-white shadow-inner font-medium' : 'text-[#faf8f4]/60 hover:bg-[#2a2825]/50 hover:text-white'}`}
            >
              <span className="mr-3 opacity-80">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-white/10 mt-auto">
          <div className="bg-[#2a2825] p-4 rounded-xl">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wider font-semibold">Přihlášen jako</div>
            <div className="text-sm font-medium truncate mb-3">{user?.email}</div>
            <button onClick={onLogout} className="text-xs text-[#c8553d] hover:text-white transition-colors uppercase tracking-wider font-bold">Odhlásit se ➔</button>
          </div>
        </div>
      </aside>

      {/* MOBILE top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f0e0d] px-4 py-4 flex items-center justify-between shadow-lg">
        <div className="font-serif text-xl text-[#c8553d]">ProposalKit</div>
        <div className="text-xs text-white/50 truncate max-w-[180px]">{user?.email}</div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pt-20 md:pt-6 px-4 md:px-12 pb-28 md:pb-12">
        {children}
      </main>

      {/* MOBILE bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0f0e0d] border-t border-white/10 bottom-nav">
        <div className="flex">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 transition-all ${currentRoute === item.id ? 'text-[#c8553d]' : 'text-white/40 hover:text-white/70'}`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </button>
          ))}
          <button
            onClick={onLogout}
            className="flex-1 flex flex-col items-center justify-center py-3 text-white/40 hover:text-white/70 transition-all"
          >
            <span className="text-xl mb-0.5">🚪</span>
            <span className="text-[10px] font-medium tracking-wide">Odhlásit</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

const Dashboard = ({ proposals, navigate, activeProposalsActions }) => {
  const total = proposals.length;
  const sent = proposals.filter(p => p.status === 'sent').length;
  const accepted = proposals.filter(p => p.status === 'accepted').length;
  const totalViews = proposals.reduce((acc, p) => acc + (p.viewCount || 0), 0);
  const acceptedValue = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + totalOf(p), 0);

  const stats = [
    { label: 'Vytvořeno', value: total },
    { label: 'Odesláno', value: sent },
    { label: 'Přijato', value: accepted },
    { label: 'Zobrazení', value: totalViews },
  ];

  return (
    <div className="animate-fade-up max-w-6xl w-full mx-auto">
      <div className="flex justify-between items-center mb-6 gap-4">
        <h1 className="font-serif text-2xl md:text-3xl text-[#0f0e0d]">Přehled nabídek</h1>
        <Button variant="accent" className="text-sm px-3 py-2" onClick={() => navigate('editor')}>+ Nová</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-[#0f0e0d]/5">
            <div className="text-[#0f0e0d]/50 text-xs uppercase tracking-wider font-semibold mb-1">{s.label}</div>
            <div className="text-2xl font-serif text-[#0f0e0d]">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0f0e0d] text-white p-4 rounded-2xl shadow-sm mb-6 flex justify-between items-center">
        <div className="text-xs uppercase tracking-wider font-semibold text-white/50">Hodnota přijatých</div>
        <div className="text-xl font-serif text-[#c8553d]">{fmt(acceptedValue)}</div>
      </div>

      {proposals.length === 0 ? (
        <div className="bg-white border border-[#0f0e0d]/10 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center">
          <div className="text-5xl mb-4 opacity-80">📇</div>
          <h3 className="font-serif text-xl mb-2 text-[#0f0e0d]">Zatím žádné nabídky</h3>
          <p className="text-[#0f0e0d]/50 mb-6 text-sm max-w-sm">Vytvořte svou první profesionální nabídku. Zabere to jen chvilku.</p>
          <Button variant="outline" onClick={() => navigate('editor')}>Vytvořit nabídku</Button>
        </div>
      ) : (
        <>
          {/* DESKTOP tabulka */}
          <div className="hidden md:block bg-white border border-[#0f0e0d]/10 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#faf8f4] text-[#0f0e0d]/60 font-medium border-b border-[#0f0e0d]/10">
                <tr>
                  <th className="px-6 py-4">Název</th>
                  <th className="px-6 py-4">Klient</th>
                  <th className="px-6 py-4">Hodnota</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Zobrazeno</th>
                  <th className="px-6 py-4">Platnost do</th>
                  <th className="px-6 py-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0f0e0d]/5">
                {proposals.map(p => (
                  <tr key={p.id} className="hover:bg-black/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-medium text-[#0f0e0d]">{p.title || 'Nepojmenovaná'}</td>
                    <td className="px-6 py-4 text-[#0f0e0d]/70">{p.clientName || '―'}</td>
                    <td className="px-6 py-4 font-medium">{fmt(totalOf(p), p.currency)}</td>
                    <td className="px-6 py-4"><Badge status={p.status} /></td>
                    <td className="px-6 py-4 text-center">
                      {p.viewCount ? <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-medium">{p.viewCount}×</span> : <span className="text-[#0f0e0d]/30">-</span>}
                    </td>
                    <td className="px-6 py-4 text-[#0f0e0d]/60">{formatDate(p.validUntil) || '―'}</td>
                    <td className="px-6 py-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => activeProposalsActions.edit(p.id)}>Upravit</Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => activeProposalsActions.preview(p.id)}>Náhled</Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => activeProposalsActions.delete(p.id)}>Smazat</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE karty */}
          <div className="md:hidden space-y-3">
            {proposals.map(p => (
              <div key={p.id} className="bg-white border border-[#0f0e0d]/10 rounded-2xl shadow-sm p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-serif text-lg text-[#0f0e0d] leading-tight">{p.title || 'Nepojmenovaná'}</div>
                    <div className="text-sm text-[#0f0e0d]/60 mt-0.5">{p.clientName || '―'}</div>
                  </div>
                  <Badge status={p.status} />
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="font-serif text-xl text-[#c8553d]">{fmt(totalOf(p), p.currency)}</div>
                  {p.validUntil && (
                    <div className="text-xs text-[#0f0e0d]/50">Do {formatDate(p.validUntil)}</div>
                  )}
                </div>

                <div className="flex gap-2 border-t border-[#0f0e0d]/5 pt-3">
                  <button className="flex-1 py-2 text-sm font-medium text-[#0f0e0d] bg-[#faf8f4] rounded-lg hover:bg-[#0f0e0d]/5 transition-colors" onClick={() => activeProposalsActions.edit(p.id)}>
                    ✏️ Upravit
                  </button>
                  <button className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors" onClick={() => activeProposalsActions.preview(p.id)}>
                    👁 Náhled
                  </button>
                  <button className="py-2 px-3 text-sm font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors" onClick={() => activeProposalsActions.delete(p.id)}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Editor = ({ user, proposalId, proposals, onSave, onCancel, showToast }) => {
  const [activeTab, setActiveTab] = useState('basic');

  const existing = proposalId ? proposals.find(p => p.id === proposalId) : null;
  const [local, setLocal] = useState(existing || {
    id: genId(), slug: '', status: 'draft', createdAt: new Date().toISOString(), title: '',
    clientName: '', clientEmail: '', intro: '', services: [{ id: genId(), name: '', qty: 1, unit: 'hod', price: 0 }],
    currency: 'CZK', validUntil: '', paymentTerms: 'Splatnost 14 dní', notes: '', requireDeposit: false, viewCount: 0,
    freelancerName: user?.name || '', freelancerEmail: user?.email || '', phone: user?.phone || '', website: user?.website || '', ico: user?.ico || ''
  });

  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!local.title.trim()) {
      showToast('Název nabídky je povinný', 'error'); return;
    }
    if (!local.slug) local.slug = genSlug(local.title);
    onSave(local);
  };

  const tabs = [
    { id: 'basic', label: 'Info' },
    { id: 'items', label: 'Položky' },
    { id: 'terms', label: 'Podmínky' },
    { id: 'sender', label: 'Odesílatel' }
  ];

  return (
    <div className="animate-fade-up max-w-4xl w-full mx-auto pb-8">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <Button variant="ghost" className="px-0 mb-1 text-[#0f0e0d]/50 hover:text-[#0f0e0d] -ml-2 text-sm" onClick={onCancel}>← Zpět</Button>
          <h1 className="font-serif text-2xl md:text-3xl text-[#0f0e0d]">{existing ? 'Úprava nabídky' : 'Nová nabídka'}</h1>
        </div>
        <Button variant="primary" className="hidden md:inline-flex px-4 py-2" onClick={handleSave}>Uložit nabídku</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#0f0e0d]/10 overflow-hidden">
        <div className="flex bg-[#faf8f4] border-b border-[#0f0e0d]/10">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-xs md:text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-white text-[#c8553d] border-b-2 border-[#c8553d]' : 'text-[#0f0e0d]/50 hover:text-[#0f0e0d]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 md:p-8">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-up" style={{ animationDuration: '0.3s' }}>
              <Input label="Název nabídky *" value={local.title} onChange={e => update('title', e.target.value)} placeholder="Např. Tvorba webových stránek" />
              <Input label="Jméno klienta/Společnost" value={local.clientName} onChange={e => update('clientName', e.target.value)} />
              <Input label="Email klienta" type="email" value={local.clientEmail} onChange={e => update('clientEmail', e.target.value)} />
              <Textarea label="Úvodní text" value={local.intro} onChange={e => update('intro', e.target.value)} placeholder="Krátký popis přesvědčující klienta ke spolupráci..." />
            </div>
          )}

          {activeTab === 'items' && (
            <div className="animate-fade-up" style={{ animationDuration: '0.3s' }}>
              <div className="space-y-3 mb-6">
                {local.services.map((item, i) => (
                  <div key={item.id} className="bg-[#faf8f4] p-4 rounded-xl border border-[#0f0e0d]/8 space-y-3">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input className="!mb-0" placeholder="Název služby" value={item.name} onChange={e => { const s = [...local.services]; s[i].name = e.target.value; update('services', s); }} />
                      </div>
                      <button className="mt-1 text-red-400 hover:text-red-600 p-2 transition-colors" onClick={() => update('services', local.services.filter(s => s.id !== item.id))}>✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-[#0f0e0d]/60 mb-1 block">Množství</label>
                        <Input className="!mb-0" type="number" placeholder="1" value={item.qty} onChange={e => { const s = [...local.services]; s[i].qty = e.target.value; update('services', s); }} />
                      </div>
                      <div>
                        <label className="text-xs text-[#0f0e0d]/60 mb-1 block">Jednotka</label>
                        <Select className="!mb-0" options={['hod', 'den', 'ks', 'měs', 'paušál']} value={item.unit} onChange={e => { const s = [...local.services]; s[i].unit = e.target.value; update('services', s); }} />
                      </div>
                      <div>
                        <label className="text-xs text-[#0f0e0d]/60 mb-1 block">Cena</label>
                        <Input className="!mb-0" type="number" placeholder="0" value={item.price} onChange={e => { const s = [...local.services]; s[i].price = e.target.value; update('services', s); }} />
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium text-[#0f0e0d]/70">
                      Celkem: {fmt(Number(item.qty) * Number(item.price), local.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center gap-3">
                <Button variant="outline" className="text-sm flex-1" onClick={() => update('services', [...local.services, { id: genId(), name: '', qty: 1, unit: 'hod', price: 0 }])}>
                  + Přidat položku
                </Button>
                <Select className="!mb-0 w-28" options={['CZK', 'EUR', 'USD']} value={local.currency} onChange={e => update('currency', e.target.value)} />
              </div>

              <div className="mt-6 pt-4 border-t border-[#0f0e0d]/10 flex justify-between items-center">
                <span className="text-sm text-[#0f0e0d]/50 uppercase tracking-wider font-semibold">Celkem bez DPH</span>
                <span className="text-2xl font-serif text-[#0f0e0d]">{fmt(totalOf(local), local.currency)}</span>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4 animate-fade-up" style={{ animationDuration: '0.3s' }}>
              <Input label="Platnost nabídky do" type="date" value={local.validUntil} onChange={e => update('validUntil', e.target.value)} />
              <Select label="Platební podmínky" options={['Splatnost 14 dní', 'Splatnost 30 dní', '50% záloha předem', 'Platba ihned']} value={local.paymentTerms} onChange={e => update('paymentTerms', e.target.value)} />
              <Textarea label="Doplňující poznámky" value={local.notes} onChange={e => update('notes', e.target.value)} />

              {user?.stripeId && (
                <div className="mt-4 border border-[#c8553d]/30 bg-[#c8553d]/5 p-4 rounded-xl border-dashed">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" id="deposit" className="w-5 h-5 mt-0.5 rounded border-[#0f0e0d]/20 text-[#c8553d] focus:ring-[#c8553d] cursor-pointer" checked={local.requireDeposit} onChange={e => update('requireDeposit', e.target.checked)} />
                    <div>
                      <label htmlFor="deposit" className="text-[#0f0e0d] font-medium text-sm mb-1 block cursor-pointer">Vyžadovat zálohu 50 % přes Stripe</label>
                      <p className="text-xs text-[#0f0e0d]/60">Klientovi se po podepsání zobrazí tlačítko pro platbu.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sender' && (
            <div className="space-y-4 animate-fade-up" style={{ animationDuration: '0.3s' }}>
              <div className="bg-[#faf8f4] p-3 text-sm text-[#0f0e0d]/70 rounded-lg border border-[#0f0e0d]/5">
                Tyto údaje se zobrazí na nabídce jako odesílatel.
              </div>
              <Input label="Vaše jméno/Název" value={local.freelancerName} onChange={e => update('freelancerName', e.target.value)} />
              <Input label="Email" type="email" value={local.freelancerEmail} onChange={e => update('freelancerEmail', e.target.value)} />
              <Input label="Telefon" type="tel" value={local.phone} onChange={e => update('phone', e.target.value)} />
              <Input label="Web" type="url" value={local.website} onChange={e => update('website', e.target.value)} />
              <Input label="IČO" value={local.ico} onChange={e => update('ico', e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile save button */}
      <div className="mt-4 md:hidden">
        <Button variant="primary" className="w-full py-3" onClick={handleSave}>Uložit nabídku</Button>
      </div>
    </div>
  );
};

const Preview = ({ proposalId, proposals, onUpdateStatus, onBack, showToast }) => {
  const proposal = proposals.find(p => p.id === proposalId);
  const [signModal, setSignModal] = useState(false);
  const [signName, setSignName] = useState('');

  if (!proposal) return <div className="p-12 text-center text-xl">Nabídka nenalezena</div>;

  const handleSignAccept = () => {
    if (!signName.trim()) { showToast('Vyplňte jméno pro platnost podpisu', 'error'); return; }
    onUpdateStatus(proposal.id, 'accepted', { signature: { name: signName, date: new Date().toISOString() } });
    setSignModal(false);
    showToast('Tato nabídka tímto nabývá právní závaznosti.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] bg-texture animate-fade-up">
      {/* Action bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#0f0e0d]/10 shadow-sm print:hidden">
        <div className="max-w-[850px] mx-auto px-4 py-3 flex justify-between items-center gap-2">
          <Button variant="ghost" onClick={onBack} className="px-2 py-1.5 text-sm">← Zpět</Button>
          <div className="flex gap-2">
            {proposal.status === 'draft' && (
              <Button variant="outline" className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-3 py-1.5" onClick={() => { onUpdateStatus(proposal.id, 'sent'); showToast('Označeno jako odeslané', 'success'); }}>
                Odeslat
              </Button>
            )}
            <Button variant="primary" className="text-xs px-3 py-1.5" onClick={() => { navigator.clipboard.writeText(window.location.origin + '?preview=' + proposal.slug); showToast('Odkaz zkopírován', 'success'); }}>
              Kopírovat odkaz 🔗
            </Button>
            <Button variant="outline" className="text-xs px-3 py-1.5 hidden md:inline-flex" onClick={() => window.print()}>
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-[850px] mx-auto bg-white shadow-2xl border-t-8 border-[#c8553d] print:shadow-none print:border-t-0 p-6 md:p-16 text-[#0f0e0d] my-0 md:my-8 md:rounded-2xl">

        <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-4">
          <div className="font-serif text-2xl md:text-4xl leading-tight">{proposal.title || 'Nabídka služeb'}</div>
          <div className="print:hidden"><Badge status={proposal.status} /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <div className="text-xs font-semibold text-[#0f0e0d]/40 mb-2 uppercase tracking-widest border-b border-black/5 pb-2">Dodavatel (Od)</div>
            <div className="font-medium text-base mb-1">{proposal.freelancerName || '―'}</div>
            <div className="text-sm text-[#0f0e0d]/70 space-y-0.5">
              {proposal.freelancerEmail && <div>{proposal.freelancerEmail}</div>}
              {proposal.phone && <div>{proposal.phone}</div>}
              {proposal.website && <div>{proposal.website}</div>}
              {proposal.ico && <div className="pt-1">IČO: {proposal.ico}</div>}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0f0e0d]/40 mb-2 uppercase tracking-widest border-b border-black/5 pb-2">Klient (Pro)</div>
            <div className="font-medium text-base mb-1">{proposal.clientName || '―'}</div>
            {proposal.clientEmail && <div className="text-sm text-[#0f0e0d]/70">{proposal.clientEmail}</div>}
          </div>
        </div>

        {proposal.intro && (
          <div className="bg-[#faf8f4] p-5 md:p-8 rounded-xl mb-10 border border-[#0f0e0d]/5 text-[#0f0e0d]/80 font-serif text-base md:text-[1.1rem] leading-relaxed">
            {proposal.intro}
          </div>
        )}

        <div className="mb-10">
          <div className="overflow-hidden border border-[#0f0e0d]/10 rounded-xl">
            {proposal.services.map(s => (
              <div key={s.id} className="px-4 md:px-6 py-4 border-b border-[#0f0e0d]/5 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-[#0f0e0d]">{s.name || 'Nezadáno'}</div>
                    <div className="text-xs text-[#0f0e0d]/50 mt-0.5">{s.qty} × {fmt(s.price, proposal.currency)} / {s.unit}</div>
                  </div>
                  <div className="font-medium text-[#0f0e0d]">{fmt(Number(s.qty) * Number(s.price), proposal.currency)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-6">
            <div className="w-full md:w-1/2 bg-[#faf8f4] p-5 rounded-xl border border-[#0f0e0d]/10">
              <div className="text-xs uppercase tracking-widest font-semibold text-[#0f0e0d]/50 mb-1">Celková částka</div>
              <div className="text-3xl font-serif text-[#c8553d]">{fmt(totalOf(proposal), proposal.currency)}</div>
              {proposal.currency === 'CZK' && <div className="text-[11px] text-[#0f0e0d]/40 mt-1">Nejsem plátce DPH.</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm bg-black/[0.02] p-5 rounded-xl border border-black/5 mb-8">
          <div>
            <div className="text-xs font-semibold text-[#0f0e0d]/40 mb-2 uppercase tracking-widest">Platnost nabídky</div>
            <div className="font-medium">{formatDate(proposal.validUntil) || '―'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0f0e0d]/40 mb-2 uppercase tracking-widest">Platební podmínky</div>
            <div className="font-medium">{proposal.paymentTerms || '―'}</div>
          </div>
        </div>

        {proposal.notes && (
          <div className="text-sm text-[#0f0e0d]/70 border-t border-black/5 pt-6 mb-8">
            <strong className="block text-[#0f0e0d] mb-2 text-xs uppercase tracking-widest">Doplňující poznámky</strong>
            <p className="whitespace-pre-line bg-[#faf8f4] p-4 rounded-lg italic text-[#0f0e0d]/60 border border-black/5">{proposal.notes}</p>
          </div>
        )}

        {proposal.status !== 'draft' && (
          <div className="mt-12 border-t-2 border-dashed border-[#0f0e0d]/10 pt-12 text-center print:hidden">
            <h4 className="font-serif text-xl md:text-2xl mb-2 text-[#0f0e0d]">Vyjádření klienta k nabídce</h4>
            <p className="text-sm text-[#0f0e0d]/50 mb-8 max-w-sm mx-auto">Tato akce odpoví dodavateli a modifikuje status dokumentu.</p>

            {proposal.status === 'sent' ? (
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button variant="primary" className="!bg-green-700 hover:!bg-green-800 text-base py-4 px-8 shadow-lg w-full sm:w-auto" onClick={() => setSignModal(true)}>
                  Přijmout a podepsat ✔
                </Button>
                <Button variant="dangerOutline" className="text-base py-4 px-8 w-full sm:w-auto" onClick={() => { onUpdateStatus(proposal.id, 'declined'); showToast('Nabídka odmítnuta.', 'error'); }}>
                  Odmítnout ✕
                </Button>
              </div>
            ) : (
              <div className="w-full max-w-md mx-auto">
                {proposal.status === 'accepted' ? (
                  <div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-900 shadow-sm">
                      <div className="text-xs uppercase tracking-widest font-bold opacity-60 mb-2">Elektronicky přijato</div>
                      <div className="font-serif text-2xl mb-2 flex items-center gap-2">
                        <span className="text-green-600">✓</span> {proposal.signature?.name || 'Podepsáno'}
                      </div>
                      <div className="text-xs opacity-70">Zaznamenáno: {proposal.signature ? formatDate(proposal.signature.date) : ''}</div>
                    </div>

                    {proposal.requireDeposit && (
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                        <h4 className="font-serif text-xl mb-2 text-blue-900">Uhrazení zálohy</h4>
                        <p className="text-blue-800/80 text-sm mb-4">Pro zahájení prací uhraďte zálohu 50 % přes Stripe.</p>
                        <Button onClick={() => showToast('Stripe Checkout (připraveno pro napojení)', 'success')} className="w-full !bg-blue-600 hover:!bg-blue-700 text-white py-3">
                          Zaplatit {fmt(totalOf(proposal) * 0.5, proposal.currency)} kartou
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-red-700 flex items-center justify-center text-lg bg-[#faf8f4] py-4 rounded-xl border border-red-200">
                    <span className="text-2xl mr-2">🛑</span> Zamítnuto a uzavřeno
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {signModal && (
        <div className="fixed inset-0 bg-[#0f0e0d]/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-up">
          <div className="bg-white p-8 rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-md relative border border-[#0f0e0d]/10 text-left">
            <button onClick={() => setSignModal(false)} className="absolute top-4 right-4 text-[#0f0e0d]/40 hover:text-[#0f0e0d] p-2">✕</button>
            <h2 className="font-serif text-2xl text-[#0f0e0d] mb-2">Závazný e-podpis</h2>
            <p className="text-sm text-[#0f0e0d]/60 mb-6 border-b border-black/5 pb-4">Pro přijetí návrhu vyplňte své celé jméno.</p>
            <Input label="Vaše celé jméno a příjmení" value={signName} onChange={e => setSignName(e.target.value)} placeholder="Např. Ing. Jan Novák" />
            <div className="bg-[#faf8f4] p-4 text-xs text-[#0f0e0d]/50 mb-6 rounded-lg border border-[#0f0e0d]/5">
              Kliknutím vyjadřujete závazný souhlas s obsahem a obchodními podmínkami této nabídky.
            </div>
            <Button variant="primary" className="w-full !bg-green-700 hover:!bg-green-800 py-3" onClick={handleSignAccept}>Závazně podepsat (E-Sign)</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Profile = ({ user, onSave, showToast }) => {
  const [local, setLocal] = useState(user || {
    name: '', email: '', phone: '', website: '', ico: '', plan: 'Free plán', stripeId: '', catalog: []
  });
  const [newCat, setNewCat] = useState({ name: '', price: 0, unit: 'hod' });
  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-3xl w-full mx-auto animate-fade-up pb-8">
      <h1 className="font-serif text-2xl md:text-3xl text-[#0f0e0d] mb-6">Profil freelancera</h1>

      {/* Mobile plan badge */}
      <div className="md:hidden bg-[#0f0e0d] text-white p-4 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wider mb-0.5">Váš plán</div>
          <div className="font-serif text-xl text-[#c8553d]">{local.plan}</div>
        </div>
        <Button variant="accent" className="text-sm px-3 py-2">Upgrade</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-[#0f0e0d]/10 p-6 md:p-8">
          <h2 className="text-lg font-serif mb-5 border-b border-black/5 pb-4">Firemní údaje</h2>
          <div className="space-y-4">
            <Input label="Jméno a příjmení / Název firmy" value={local.name} onChange={e => update('name', e.target.value)} />
            <Input label="Fakturační email" type="email" value={local.email} onChange={e => update('email', e.target.value)} />
            <Input label="Telefon" type="tel" value={local.phone} onChange={e => update('phone', e.target.value)} />
            <Input label="Webové stránky" type="url" placeholder="https://" value={local.website} onChange={e => update('website', e.target.value)} />

            <div className="pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold mb-3 text-[#0f0e0d]">Stripe (přijímání záloh)</h3>
              <Input label="Stripe Account ID" placeholder="acct_..." value={local.stripeId || ''} onChange={e => update('stripeId', e.target.value)} />
              <p className="text-xs text-[#0f0e0d]/60 -mt-2">Po nastavení se klientům zobrazí možnost platby zálohy kartou.</p>
            </div>

            <div className="pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold mb-1 text-[#0f0e0d]">Katalog služeb</h3>
              <p className="text-xs text-[#0f0e0d]/60 mb-3">Položky přidávejte zrychleně do nabídek.</p>

              <div className="space-y-2 mb-4">
                {(local.catalog || []).map(item => (
                  <div key={item.id} className="flex gap-3 bg-[#faf8f4] p-3 rounded-lg border border-[#0f0e0d]/5 text-sm items-center">
                    <span className="flex-1 font-medium">{item.name}</span>
                    <span className="text-[#0f0e0d]/60 text-xs">{fmt(item.price)} / {item.unit}</span>
                    <button className="text-red-500 hover:bg-red-50 px-2 py-1 rounded" onClick={() => update('catalog', local.catalog.filter(i => i.id !== item.id))}>✕</button>
                  </div>
                ))}
              </div>

              <div className="bg-[#faf8f4] p-3 rounded-lg border border-[#0f0e0d]/10 space-y-2">
                <Input className="!mb-0" placeholder="Název služby" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input className="!mb-0" label="Cena" type="number" value={newCat.price} onChange={e => setNewCat({ ...newCat, price: e.target.value })} />
                  <Select className="!mb-0" label="Jednotka" options={['hod', 'den', 'ks', 'měs', 'paušál']} value={newCat.unit} onChange={e => setNewCat({ ...newCat, unit: e.target.value })} />
                </div>
                <Button variant="outline" className="w-full text-sm" onClick={() => {
                  if (newCat.name) {
                    update('catalog', [...(local.catalog || []), { id: genId(), ...newCat }]);
                    setNewCat({ name: '', price: 0, unit: 'hod' });
                  }
                }}>+ Přidat do katalogu</Button>
              </div>
            </div>

            <div className="pt-4 border-t border-black/5">
              <Button variant="primary" className="w-full py-3" onClick={() => { onSave(local); showToast('Profil úspěšně uložen', 'success'); }}>
                Uložit profil
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop plan card */}
        <div className="hidden md:block md:col-span-1">
          <div className="bg-[#0f0e0d] text-[#faf8f4] rounded-2xl shadow-lg p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-16 translate-x-16 blur-2xl"></div>
            <div className="text-[#faf8f4]/50 text-xs font-semibold uppercase tracking-widest mb-1">Váš plán</div>
            <div className="font-serif text-3xl mb-4 text-[#c8553d]">{local.plan}</div>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">Máte přístup k základním funkcím. Upgradujte pro odstranění limitů.</p>
            <Button variant="accent" className="w-full">Upgrade plánu</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- APP ENTRY ---
export default function ProposalKit() {
  const [user, setUser] = useSafeState('pk_user', null);
  const [proposals, setProposals] = useState([]);
  const [currentRoute, setCurrentRoute] = useState('landing');
  const [activeId, setActiveId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [authModal, setAuthModal] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('preview');
    if (!p) return;
    proposalsService.getBySlug(p)
      .then(proposal => {
        if (proposal) {
          setProposals([proposal]);
          setActiveId(proposal.id);
          setCurrentRoute('preview');
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (user && currentRoute === 'landing') setCurrentRoute('dashboard');
    if (!user && currentRoute !== 'landing' && currentRoute !== 'preview') setCurrentRoute('landing');
  }, [user, currentRoute]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(prev => prev || {
          id: session.user.id,
          email: session.user.email,
          name: '', phone: '', website: '', ico: '', plan: 'Free plán'
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setCurrentRoute('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    proposalsService.getAll(user.id)
      .then(setProposals)
      .catch(err => showToast('Chyba načítání: ' + err.message, 'error'));
  }, [user?.id]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const handleLogin = (supabaseUser) => {
    setUser({ id: supabaseUser.id, email: supabaseUser.email, name: '', phone: '', website: '', ico: '', plan: 'Free plán' });
    setAuthModal(false);
    showToast(`Přihlášen jako ${supabaseUser.email}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentRoute('landing');
    showToast('Byli jste odhlášeni');
  };

  const activeProposalsActions = {
    edit: (id) => { setActiveId(id); setCurrentRoute('editor'); },
    preview: (id) => { setActiveId(id); setCurrentRoute('preview'); },
    delete: async (id) => {
      if (window.confirm('Opravdu chcete smazat tuto nabídku?')) {
        try {
          await proposalsService.delete(id);
          setProposals(prev => prev.filter(p => p.id !== id));
          showToast('Nabídka smazána', 'success');
        } catch (err) {
          showToast('Chyba mazání: ' + err.message, 'error');
        }
      }
    }
  };

  const saveProposal = async (proposal) => {
    try {
      await proposalsService.save(user.id, proposal);
      setProposals(prev => {
        const idx = prev.findIndex(p => p.id === proposal.id);
        if (idx > -1) { const n = [...prev]; n[idx] = proposal; return n; }
        return [proposal, ...prev];
      });
      setCurrentRoute('dashboard');
      showToast('Nabídka uložena', 'success');
    } catch (err) {
      showToast('Chyba uložení: ' + err.message, 'error');
    }
  };

  const updateProposalStatus = async (id, newStatus, extraData = {}) => {
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus, ...extraData } : p));
    try {
      await proposalsService.updateStatus(id, newStatus, extraData);
    } catch (err) {
      console.error('Chyba při aktualizaci statusu:', err);
    }
  };

  return (
    <div className="font-sans text-[#0f0e0d] bg-[#faf8f4] min-h-screen bg-texture selection:bg-[#c8553d]/20">
      <GlobalStyles />

      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="animate-fade-up bg-[#0f0e0d] text-white px-4 py-3 rounded-xl shadow-2xl text-sm flex items-center min-w-[220px] border border-white/10">
            <span className={`mr-2 ${t.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>●</span>
            <span className="font-medium">{t.message}</span>
          </div>
        ))}
      </div>

      <AuthModal isOpen={authModal} onClose={() => setAuthModal(false)} onLogin={handleLogin} />

      {currentRoute === 'landing' && <LandingPage onStart={() => setAuthModal(true)} />}

      {currentRoute === 'preview' && (
        <Preview
          proposalId={activeId}
          proposals={proposals}
          onBack={() => setCurrentRoute('dashboard')}
          onUpdateStatus={updateProposalStatus}
          showToast={showToast}
        />
      )}

      {(currentRoute === 'dashboard' || currentRoute === 'editor' || currentRoute === 'profile') && (
        <Layout user={user} currentRoute={currentRoute} navigate={setCurrentRoute} onLogout={handleLogout}>
          {currentRoute === 'dashboard' && <Dashboard proposals={proposals} navigate={setCurrentRoute} activeProposalsActions={activeProposalsActions} />}
          {currentRoute === 'editor' && <Editor user={user} proposalId={activeId} proposals={proposals} onSave={saveProposal} onCancel={() => setCurrentRoute('dashboard')} showToast={showToast} />}
          {currentRoute === 'profile' && <Profile user={user} onSave={setUser} showToast={showToast} />}
        </Layout>
      )}
    </div>
  );
}
