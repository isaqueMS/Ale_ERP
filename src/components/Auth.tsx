import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Scissors, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [formData, setFormData] = React.useState({ email: '', password: '', name: '' });

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cleanPhone = user.email?.replace('@estudioale.com', '') || '';
        if (cleanPhone !== '7185062361') {
          try {
            const staffQuery = query(collection(db, 'staff'), where('uid', '==', user.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty && staffSnapshot.docs[0].data().status === 'inactive') {
               await signOut(auth);
               return;
            }
          } catch (err) { console.error(err); }
        }
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cleanPhone = formData.email.replace(/\D/g, '');
      const emailToUse = cleanPhone.length >= 10 ? `${cleanPhone}@estudioale.com` : formData.email;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, formData.password);
        if (cleanPhone !== '7185062361') {
          const staffQuery = query(collection(db, 'staff'), where('uid', '==', userCredential.user.uid));
          const staffSnapshot = await getDocs(staffQuery);
          if (!staffSnapshot.empty && staffSnapshot.docs[0].data().status === 'inactive') {
            await signOut(auth);
            setError('Sua conta está inativa. Entre em contato com o administrador.');
            setLoading(false);
            return;
          }
        }
      } catch (signInErr: any) {
        if (cleanPhone === '7185062361' && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential')) {
          try { await createUserWithEmailAndPassword(auth, emailToUse, formData.password); } 
          catch (createErr: any) { if (createErr.code === 'auth/email-already-in-use') throw signInErr; throw createErr; }
        } else throw signInErr;
      }
      navigate('/');
    } catch (err: any) {
      setError('Acesso negado. Verifique suas credenciais de operação.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent rounded-full blur-[150px]" />
         <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="inline-flex items-center justify-center bg-secondary/40 p-6 rounded-[2.5rem] mb-8 border border-white/5 shadow-2xl backdrop-blur-3xl group hover:rotate-12 transition-transform">
            <Scissors className="text-accent w-12 h-12" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
            Estúdio <span className="metallic-gold">Alê</span>
          </h1>
          <p className="text-muted mt-4 font-black uppercase text-[10px] tracking-[0.5em] opacity-40">Luxury Management Protocol</p>
        </div>

        <div className="glass-card p-12 bg-secondary/10 border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-700">
          <div className="flex items-center gap-3 mb-10 border-b border-white/5 pb-6">
             <ShieldCheck className="text-accent w-6 h-6" />
             <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Autenticação Terminal</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.3em] ml-2">Registro de Operador</label>
              <div className="relative group">
                <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted transition-colors group-focus-within:text-accent" />
                <input 
                  required
                  type="text" 
                  className="input-field pl-16 py-6 bg-primary/50 text-white border-white/5 focus:border-accent/20" 
                  placeholder="DIGITE SEU TELEFONE"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.3em] ml-2">Código de Acesso</label>
              <div className="relative group">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted transition-colors group-focus-within:text-accent" />
                <input 
                  required
                  type="password" 
                  className="input-field pl-16 py-6 bg-primary/50 text-white border-white/5 focus:border-accent/20" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-5 bg-red-500/10 text-red-500 rounded-3xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 animate-in shake duration-300">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-accent py-6 text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(212,175,55,0.2)] hover:shadow-[0_0_70px_rgba(212,175,55,0.3)] transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
              ) : (
                <>
                  Iniciar Sessão
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-[8px] mt-16 font-black uppercase tracking-[0.5em] opacity-20 leading-none">
          Locked for exclusive studio operations &copy; 2024
        </p>
      </div>
    </div>
  );
}
