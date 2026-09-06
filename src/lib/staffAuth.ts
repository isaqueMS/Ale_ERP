import { initializeApp, deleteApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { firebaseConfig, auth as primaryAuth } from './firebase';

const SECONDARY_APP_NAME = 'staff-creation';

async function getSecondaryApp(): Promise<FirebaseApp> {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  return existing || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
}

/**
 * Cria uma conta de login (Firebase Auth) para um profissional novo, SEM
 * derrubar a sessão do admin logado no app principal.
 *
 * Antes, a "senha de acesso" digitada no cadastro de equipe era apenas
 * salva em texto plano no Firestore e nunca virava um login de verdade
 * (ver StaffManagement.tsx). Agora usamos uma instância secundária e
 * temporária do Firebase App só para criar o usuário no Auth; a sessão do
 * admin (na instância principal, exportada por ./firebase) não é afetada.
 *
 * Retorna o uid do novo usuário. A senha NUNCA é persistida em nenhum lugar.
 */
export async function createStaffLogin(email: string, password: string): Promise<string> {
  const secondaryApp = await getSecondaryApp();
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Envia um e-mail de redefinição de senha para um profissional já existente.
 * Usa a instância PRINCIPAL do Firebase Auth: não precisa saber a senha
 * atual e não afeta a sessão de quem está enviando (o admin continua logado).
 */
export async function sendStaffPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(primaryAuth, email);
}
