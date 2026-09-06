/**
 * Cloudflare Worker que dispara mensagens de WhatsApp via Meta Cloud API,
 * usado pela tela "Enviar Promoção" do app (src/components/ClientManagement.tsx)
 * através de src/lib/whatsapp.ts — sem precisar do plano Blaze do Firebase.
 *
 * Rotas:
 *  POST /send-text     { phone, message } -> manda texto livre.
 *  POST /send-template  { phone }          -> manda o template "studio" (boas-vindas).
 *
 * Segurança: cada chamada precisa do cabeçalho
 *   Authorization: Bearer <ID token do Firebase do usuário logado>
 * O Worker confere esse token direto com o Firebase (Identity Toolkit) antes
 * de fazer qualquer coisa — só usuários logados no app conseguem disparar
 * mensagens. O token de acesso da Meta (WHATSAPP_TOKEN) fica só aqui no
 * Worker, nunca é enviado para o navegador.
 *
 * ANTES DE DAR DEPLOY:
 *  1. npx wrangler login
 *  2. npx wrangler secret put WHATSAPP_TOKEN   (cole o token permanente da Meta)
 *  3. npx wrangler deploy
 *  4. Copie a URL que aparecer (https://....workers.dev) para
 *     src/lib/whatsapp.ts (constante WORKER_BASE_URL).
 */

const PHONE_NUMBER_ID = '1056793024186250';
const GRAPH_API_VERSION = 'v20.0';
const WELCOME_TEMPLATE_NAME = 'studio';
// Ajuste para 'en_US' se a Meta recusar dizendo que o template/idioma não existe.
const TEMPLATE_LANGUAGE = 'en';

// Web API key do próprio projeto Firebase (a mesma de firebase-applet-config.json).
// Não é segredo — é a chave pública usada por qualquer app Firebase no navegador.
const FIREBASE_WEB_API_KEY = 'AIzaSyAWy5-XK9_1bgrdU7pPIGxbt2TnKHYJKUg';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function cleanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Garante o DDI do Brasil (55) na frente, sem duplicar caso já venha com ele.
  if (digits.length > 11 && digits.startsWith('55')) return digits;
  return `55${digits}`;
}

async function verifyFirebaseToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0] || null;
}

async function callGraphApi(token, body) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Erro ao chamar a API da Meta');
    err.metaError = data?.error || null;
    throw err;
  }
  return data;
}

// Erro 131047 = "Re-engagement message": mais de 24h desde a última
// mensagem recebida desse cliente. É o sinal de "janela fechada".
function isWindowClosedError(metaError) {
  return !!metaError && (metaError.code === 131047 || metaError.error_subcode === 2018278);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) return json({ error: 'unauthenticated' }, 401);

    const user = await verifyFirebaseToken(idToken);
    if (!user) return json({ error: 'unauthenticated' }, 401);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }

    const phone = payload?.phone;
    const message = payload?.message;
    if (!phone) return json({ error: 'invalid_argument', message: 'Telefone é obrigatório.' }, 400);

    const url = new URL(request.url);

    try {
      if (url.pathname === '/send-template') {
        const result = await callGraphApi(env.WHATSAPP_TOKEN, {
          messaging_product: 'whatsapp',
          to: cleanPhone(phone),
          type: 'template',
          template: { name: WELCOME_TEMPLATE_NAME, language: { code: TEMPLATE_LANGUAGE } }
        });
        return json({ success: true, messageId: result?.messages?.[0]?.id || null });
      }

      if (url.pathname === '/send-text') {
        if (!message) return json({ error: 'invalid_argument', message: 'Mensagem é obrigatória.' }, 400);
        const result = await callGraphApi(env.WHATSAPP_TOKEN, {
          messaging_product: 'whatsapp',
          to: cleanPhone(phone),
          type: 'text',
          text: { body: message, preview_url: false }
        });
        return json({ success: true, messageId: result?.messages?.[0]?.id || null });
      }

      return json({ error: 'not_found' }, 404);
    } catch (error) {
      if (isWindowClosedError(error.metaError)) {
        return json({ error: 'window_closed', message: 'window_closed' }, 412);
      }
      return json({ error: 'internal', message: error.message }, 500);
    }
  }
};
