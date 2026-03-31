import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Scissors, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    name: ''
  });

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Verificar se o atendente está ativo antes de navegar
        const cleanPhone = user.email?.replace('@estudioale.com', '') || '';
        if (cleanPhone !== '7185062361') {
          try {
            const staffQuery = query(collection(db, 'staff'), where('uid', '==', user.uid));
            const staffSnapshot = await getDocs(staffQuery);
            
            if (!staffSnapshot.empty) {
              const staffData = staffSnapshot.docs[0].data();
              if (staffData.status === 'inactive') {
                await signOut(auth);
                return;
              }
            }
          } catch (err) {
            console.error('Erro ao verificar status do atendente:', err);
          }
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
      // Limpar o telefone para criar o pseudo-email
      const cleanPhone = formData.email.replace(/\D/g, '');
      const emailToUse = cleanPhone.length >= 10 
        ? `${cleanPhone}@estudioale.com` 
        : formData.email;

      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, formData.password);
        
        // Verificar se o atendente está ativo (não aplica ao admin principal)
        if (cleanPhone !== '7185062361') {
          const staffQuery = query(collection(db, 'staff'), where('uid', '==', userCredential.user.uid));
          const staffSnapshot = await getDocs(staffQuery);
          
          if (!staffSnapshot.empty) {
            const staffData = staffSnapshot.docs[0].data();
            if (staffData.status === 'inactive') {
              await signOut(auth);
              setError('Sua conta está inativa. Entre em contato com o administrador.');
              setLoading(false);
              return;
            }
          }
        }
      } catch (signInErr: any) {
        // Se for o admin e falhar o login, tenta criar a conta (caso não exista)
        // Verificamos por user-not-found ou invalid-credential (que pode ser retornado se a proteção de enumeração estiver ativa)
        if (cleanPhone === '7185062361' && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential')) {
          try {
            await createUserWithEmailAndPassword(auth, emailToUse, formData.password);
          } catch (createErr: any) {
            // Se falhar a criação porque já existe, o erro original de login era provavelmente senha errada
            if (createErr.code === 'auth/email-already-in-use') {
              throw signInErr;
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }
      navigate('/');
    } catch (err: any) {
      let message = 'Usuário ou senha incorretos. Por favor, tente novamente.';
      if (err.code === 'auth/too-many-requests') {
        message = 'Muitas tentativas. Tente novamente mais tarde.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Erro de conexão. Verifique sua internet.';
      } else if (err.code === 'auth/internal-error') {
        message = 'Erro interno do Firebase. Tente novamente.';
      } else if (err.code) {
        message = `Erro: ${err.code}. Verifique seus dados.`;
      }
      setError(message);
      console.error('Login error:', err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center justify-center bg-primary/20 p-4 rounded-3xl mb-6 shadow-sm">
            <Scissors className="text-primary w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-text tracking-tight">
            Estúdio da <span className="text-primary">Alê</span>
          </h1>
          <p className="text-muted mt-2 font-medium">Gestão inteligente para o seu salão</p>
        </div>

        <div className="glass-card p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <h2 className="text-2xl font-bold text-text mb-8">Bem-vinda de volta!</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Usuário (Telefone)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input 
                  required
                  type="text" 
                  className="input-field pl-12" 
                  placeholder="71 99999-9999"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input 
                  required
                  type="password" 
                  className="input-field pl-12" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 animate-in shake duration-300">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-primary py-4 text-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-12 font-medium">
          &copy; 2024 Estúdio da Alê. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
