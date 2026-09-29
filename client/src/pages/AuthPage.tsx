import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsDemo, login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleDemoLogin = () => {
    loginAsDemo();
    navigate('/dashboard');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login('token_' + Date.now(), {
      id: '00000000-0000-0000-0000-000000000001',
      email: email || 'creator@cineforge.ai',
      full_name: email.split('@')[0] || 'Lead Director',
      tier: 'creator',
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/15 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 glass-panel-glow rounded-3xl p-8 border border-slate-800 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-600/30 mx-auto">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-3">
            CINEFORGE <span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Autonomous, duration-aware AI video orchestration and rendering engine.
          </p>
        </div>

        {/* 1-Click Instant Creator Access */}
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-center space-y-2.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-300">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Instant Demo Access</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Launch straight into the Production Studio with full orchestration capabilities.
          </p>
          <button
            onClick={handleDemoLogin}
            type="button"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Enter Studio as Lead Director</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-950 px-3 text-[11px] font-mono text-slate-500 uppercase">Or continue with email</span>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="director@cineforge.ai"
              className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Sign In with Supabase
          </button>
        </form>
      </div>
    </div>
  );
};
