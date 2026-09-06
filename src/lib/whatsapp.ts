import { auth } from './firebase';

// Depois de rodar `npx wrangler deploy` na pasta whatsapp-worker/, troque
// pela URL real que aparecer no terminal (algo como
// https://estudio-ale-whatsapp.SEU-USUARIO.workers.dev).
const WORKER_BASE_URL = 'https://estudio-ale-whatsapp.estudioale.workers.dev';

async function callWorker(path: string, body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error('É preciso estar autenticado.');
  const idToken = await user.getIdToken();

  const res = await fetch(`${WORKER_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const err: any = new Error(data?.message || data?.error || 'Falha ao enviar mensagem.');
    err.code = data?.error;
    throw err;
  }
  return data;
}

// Manda texto livre — só funciona se o cliente respondeu alguma mensagem nas
// últimas 24h (regra da Meta). Se a janela estiver fechada, lança um erro com
// err.code === 'window_closed' para quem chamou tentar sendWhatsAppTemplate.
export async function sendWhatsAppText(phone: string, message: string) {
  return callWorker('/send-text', { phone, message });
}

// Manda o template aprovado "studio" (boas-vindas), usado para reabrir a
// janela de 24h com clientes que não conversam há um tempo.
export async function sendWhatsAppTemplate(phone: string) {
  return callWorker('/send-template', { phone });
}
