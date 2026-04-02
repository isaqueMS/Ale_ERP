import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Scissors, Phone, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-[#FFFDFB] flex flex-col items-center justify-center p-4 font-['Outfit'] overflow-hidden">
      {/* PHOTO STYLE: LOGIN CARD */}
      <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.06)] border border-slate-50 relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#FFB6C1]/20" />

        {/* Compact Logo inside Card */}
        <div className="flex flex-col items-center mb-5">
           <img src="./logo.png" alt="Logo" className="w-16 h-16 object-contain mb-2" />
           <h1 className="text-3xl font-black text-slate-700 tracking-tighter italic leading-none">
             Estúdio da <span className="text-[#FFB6C1] not-italic">Alê</span>
           </h1>
           <p className="text-slate-300 font-black text-[8px] uppercase tracking-[0.3em] mt-2 opacity-80">Gestão Inteligente</p>
        </div>

        <h2 className="text-[9px] font-black text-slate-300 mb-4 text-center uppercase tracking-[0.2em] pt-4 border-t border-slate-50">Painel de Acesso</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="label-premium !text-[9px] !mb-1">E-mail ou Telefone</label>
            <div className="relative">
              <input
                type="text"
                required
                className="input-premium pl-11 pr-4 !py-3 text-[12px] shadow-sm"
                placeholder="Seu login studio..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFB6C1]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label-premium !text-[9px] !mb-1">Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                className="input-premium pl-11 pr-4 !py-3 text-[12px] shadow-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFB6C1]" />
            </div>
          </div>

          <div className="flex items-center gap-3 py-1 ml-1 cursor-pointer group">
            <input
              type="checkbox"
              id="remember"
              className="checkbox-premium"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="remember" className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter cursor-pointer group-hover:text-[#FFB6C1] transition-colors">Manter acesso conectado</label>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 text-[10px] font-black p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
              <p className="leading-tight">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-pink-100"
          >
            {loading ? 'Validando...' : 'Entrar no ERP Studio'}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[7px] font-black text-slate-200 uppercase tracking-[0.2em] leading-relaxed">
            Área restrita • Studio Alexandra 2024
          </p>
        </div>
      </div>
    </div>
  );
}
