import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPhone(value: string) {
  const cleaned = ('' + value).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return value;
}

export function getWhatsAppLink(phone: string, message: string = '') {
  const cleaned = ('' + phone).replace(/\D/g, '');
  return `https://wa.me/55${cleaned}?text=${encodeURIComponent(message)}`;
}

// Compara dois telefones ignorando formatação, DDI e o "9" extra que o
// WhatsApp às vezes omite/inclui em números de celular brasileiros — usado
// pela Caixa de Entrada (Inbox.tsx) para casar o telefone que chega do
// WhatsApp com o telefone cadastrado do cliente.
export function phonesMatch(a: string, b: string) {
  const digitsA = ('' + a).replace(/\D/g, '');
  const digitsB = ('' + b).replace(/\D/g, '');
  if (digitsA.length < 8 || digitsB.length < 8) return false;
  return digitsA.slice(-8) === digitsB.slice(-8);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  // Detalhe completo (inclui e-mail/uid) só vai para o console de
  // desenvolvimento — nunca para a mensagem de erro, que pode acabar
  // exibida ao usuário final (ver ErrorBoundary.tsx).
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(`Falha ao ${operationType} dados${path ? ' em ' + path : ''}. Tente novamente.`);
}
