import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, User, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

// Email fixo do administrador master - sem dependência de Firestore para roles
const ADMIN_EMAIL = '7185062361@estudioale.com';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isAgente: boolean;
  signIn: (e: string, p: string, remember?: boolean) => Promise<any>;
  signUp: (e: string, p: string, n: string, remember?: boolean) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isAgente: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
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

  // Login
  const signIn = async (email: string, pass: string, remember: boolean = true) => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email.includes('@') ? email : `${email}@estudioale.com`, pass);
  };

  // Register
  const signUp = async (email: string, pass: string, name: string, remember: boolean = true) => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const formattedEmail = email.includes('@') ? email : `${email}@estudioale.com`;
    const res = await createUserWithEmailAndPassword(auth, formattedEmail, pass);
    
    // Create initial user doc
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    await setDoc(doc(db, 'users', res.user.uid), {
      name,
      email: formattedEmail,
      role: 'staff',
      createdAt: new Date().toISOString()
    });
    
    return res;
  };

  // Logout
  const signOut = async () => {
    return firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isAgente, signIn, signUp, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
