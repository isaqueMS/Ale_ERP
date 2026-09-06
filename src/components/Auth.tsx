import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Phone, Lock, ArrowRight, Scissors, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-background flex font-sans">
      {/* Painel de marca — visível a partir de telas grandes */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#E38EA0] to-[#C15F76] items-center justify-center p-12">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white/10 translate-x-1/3 translate-y-1/3" aria-hidden="true" />
        <div className="absolute top-1/3 right-16 w-24 h-24 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative z-10 text-center max-w-sm">
          <img src="./logo.png" alt="Logo Estúdio da Alê" className="w-24 h-24 object-contain mx-auto mb-6 drop-shadow-lg" />
          <h1 className="text-5xl font-display italic font-semibold text-white leading-tight mb-4">
            Estúdio da <span className="not-italic">Alê</span>
          </h1>
          <p className="text-white/85 text-base font-medium leading-relaxed">
            Agenda, clientes, financeiro e comandas em um só lugar — feito sob medida para o seu studio.
          </p>
          <div className="flex items-center justify-center gap-2 mt-8 text-white/80">
            <Scissors className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs uppercase tracking-widest font-semibold">Gestão Inteligente</span>
          </div>
        </div>
      </div>

      {/* Painel do formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Cabeçalho compacto — só em telas pequenas, onde o painel de marca some */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src="./logo.png" alt="Logo Estúdio da Alê" className="w-16 h-16 object-contain mb-3" />
            <h1 className="text-3xl font-display font-semibold text-slate-700 italic tracking-tight leading-none">
              Estúdio da <span className="text-primary not-italic">Alê</span>
            </h1>
            <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-widest mt-2">Gestão Inteligente</p>
          </div>

          <div className="card-premium p-6 sm:p-8 animate-fade-up">
            <div className="hidden lg:block mb-6">
              <h2 className="text-2xl font-display font-semibold text-slate-700">Bem-vinda de volta</h2>
              <p className="text-sm text-slate-400 mt-1">Entre com seus dados de acesso.</p>
            </div>
            <h2 className="lg:hidden text-xs font-semibold text-slate-400 mb-5 text-center uppercase tracking-widest pt-4 border-t border-slate-100">
              Painel de Acesso
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-id" className="label-premium">E-mail ou Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" aria-hidden="true" />
                  <input
                    id="login-id"
                    type="text"
                    required
                    autoComplete="username"
                    className="input-premium pl-11"
                    placeholder="Seu e-mail ou telefone"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="label-premium">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="input-premium pl-11 pr-11"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1 cursor-pointer group">
                <input
                  type="checkbox"
                  id="remember"
                  className="checkbox-premium"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember" className="text-xs font-semibold text-slate-500 cursor-pointer group-hover:text-primary transition-colors">
                  Manter acesso conectado
                </label>
              </div>

              {error && (
                <div role="alert" className="bg-red-50 text-red-500 text-xs font-semibold p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" aria-hidden="true" />
                  <p className="leading-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-14 rounded-2xl text-sm uppercase tracking-widest font-semibold group shadow-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Validando...
                  </>
                ) : (
                  <>
                    Entrar no ERP Studio
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] font-medium text-slate-300 uppercase tracking-widest mt-6">
            Área restrita • Studio Alexandra 2024
          </p>
        </div>
      </div>
    </div>
  );
}
