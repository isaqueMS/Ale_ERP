import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

// Email fixo do administrador master - sem dependência de Firestore para roles
const ADMIN_EMAIL = '7185062361@estudioale.com';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isAgente: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isAgente: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgente, setIsAgente] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("LOGIN STATUS - Email detectado:", firebaseUser?.email);
      setUser(firebaseUser);
      if (firebaseUser) {
        setLoading(true);
        const { getDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          }

          // Verificar se o atendente está ativo (não aplica ao admin principal)
          const userEmail = firebaseUser.email?.toLowerCase() || "";
          const isOwnerByEmail = userEmail === "7185062361@estudioale.com" || 
                                userEmail === "admin@estudioale.com" ||
                                userEmail === "alexandra@estudioale.com" ||
                                firebaseUser.uid?.startsWith('7185062361');
          
          if (!isOwnerByEmail) {
            const staffQuery = query(collection(db, 'staff'), where('uid', '==', firebaseUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            
            if (!staffSnapshot.empty) {
              const staffData = staffSnapshot.docs[0].data();
              if (staffData.status === 'inactive') {
                await signOut(auth);
                setUser(null);
                setProfile(null);
                setLoading(false);
                return;
              }
            }
          }
        } catch (error) {
          console.error("Erro ao carregar perfil do Firestore:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Lógica de detecção de Admin e Agente
  useEffect(() => {
    const userEmail = user?.email?.toLowerCase() || "";
    const isOwnerByEmail = userEmail === "7185062361@estudioale.com" || 
                          userEmail === "admin@estudioale.com" ||
                          userEmail === "alexandra@estudioale.com" ||
                          user?.uid?.startsWith('7185062361');
                          
    const adminStatus = isOwnerByEmail || profile?.role === 'admin';
    setIsAdmin(adminStatus);
    setIsAgente(!adminStatus && profile?.role === 'agente');
  }, [user, profile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isAgente }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
