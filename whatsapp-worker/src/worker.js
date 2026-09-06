/**
 * Cloudflare Worker que dispara mensagens de WhatsApp via Meta Cloud API,
 * usado pela tela "Enviar Promoção" e pela Caixa de Entrada do app
 * (src/components/ClientManagement.tsx e src/components/Inbox.tsx) através
 * de src/lib/whatsapp.ts — sem precisar do plano Blaze do Firebase.
 *
 * Rotas:
 *  POST /send-text      { phone, message } -> manda texto livre.
 *  POST /send-template   { phone }          -> manda o template "studio" (boas-vindas).
 *  POST /send-document    { phone, filename, base64Pdf, caption? } -> manda um PDF (Nota de Serviço).
 *  GET  /webhook         -> handshake de verificação do Webhook da Meta.
 *  POST /webhook         -> recebe mensagens dos clientes e status de entrega/leitura.
 *
 * Segurança (rotas /send-*): cada chamada precisa do cabeçalho
 *   Authorization: Bearer <ID token do Firebase do usuário logado>
 * O Worker confere esse token direto com o Firebase (Identity Toolkit) antes
 * de fazer qualquer coisa — só usuários logados no app conseguem disparar
 * mensagens. O token de acesso da Meta (WHATSAPP_TOKEN) fica só aqui no
 * Worker, nunca é enviado para o navegador.
 *
 * Segurança (rota /webhook): a Meta assina cada requisição com o cabeçalho
 * X-Hub-Signature-256, calculado com o "App Secret" do app na Meta. O Worker
 * confere essa assinatura antes de processar qualquer evento.
 *
 * Toda mensagem (enviada ou recebida) é gravada no Firestore usando a API
 * REST do Firestore autenticada como uma Service Account do Google Cloud —
 * isso dá acesso de "administrador" ao banco sem precisar do Firebase Admin
 * SDK (que não roda em Cloudflare Workers) e sem depender das regras de
 * segurança do Firestore, mantendo o token da Meta e a chave da Service
 * Account só aqui no Worker.
 *
 * ANTES DE DAR DEPLOY (ver README no fim do arquivo para o passo a passo):
 *  1. npx wrangler login
 *  2. npx wrangler secret put WHATSAPP_TOKEN            (token permanente da Meta)
 *  3. npx wrangler secret put WHATSAPP_APP_SECRET        (App Secret do app na Meta)
 *  4. npx wrangler secret put WHATSAPP_VERIFY_TOKEN      (uma senha inventada por você)
 *  5. npx wrangler secret put GCP_SERVICE_ACCOUNT_KEY    (conteúdo do JSON da Service Account)
 *  6. npx wrangler deploy
 *  7. Configurar o Webhook na Meta com a URL https://SEU-WORKER.workers.dev/webhook
 *     e o mesmo valor de WHATSAPP_VERIFY_TOKEN do passo 4.
 */

const PHONE_NUMBER_ID = '1056793024186250';
const GRAPH_API_VERSION = 'v20.0';
const WELCOME_TEMPLATE_NAME = 'studio';
// Ajuste para 'en_US' se a Meta recusar dizendo que o template/idioma não existe.
const TEMPLATE_LANGUAGE = 'en';

// ID do projeto no Firebase/Google Cloud (o mesmo de firebase-applet-config.json).
const GCP_PROJECT_ID = 'chess-d6bcf';

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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Sobe um arquivo (ex.: o PDF da Nota de Serviço) pro "media library" da
// Meta antes de poder mandar como documento — a API não aceita o arquivo
// direto dentro da mensagem, só um media id de um upload prévio.
async function uploadMediaToGraphApi(token, base64Data, filename, mimeType) {
  const bytes = base64ToBytes(base64Data);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([bytes], { type: mimeType }), filename);

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Erro ao subir arquivo pra Meta');
    err.metaError = data?.error || null;
    throw err;
  }
  return data.id;
}

// Erro 131047 = "Re-engagement message": mais de 24h desde a última
// mensagem recebida desse cliente. É o sinal de "janela fechada".
function isWindowClosedError(metaError) {
  return !!metaError && (metaError.code === 131047 || metaError.error_subcode === 2018278);
}

/* ------------------------------------------------------------------ */
/* Autenticação como Service Account do Google Cloud (JWT assinado com */
/* RS256 via Web Crypto) — usada só para gravar no Firestore por REST. */
/* ------------------------------------------------------------------ */

function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Cache simples em memória (dura enquanto essa instância do Worker estiver
// viva). Evita gerar um token novo a cada mensagem.
let cachedToken = null;

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.accessToken;

  const sa = JSON.parse(env.GCP_SERVICE_ACCOUNT_KEY);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Falha ao autenticar Service Account: ' + JSON.stringify(data));
  cachedToken = { accessToken: data.access_token, expiresAt: now + (data.expires_in || 3500) };
  return cachedToken.accessToken;
}

/* ------------------------------------------------------------------ */
/* Gravação no Firestore via API REST (bypassa as regras de segurança, */
/* igual o Admin SDK faria — por isso usa a Service Account acima).    */
/* ------------------------------------------------------------------ */

function fsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}

function fsFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = fsValue(v);
  return fields;
}

function docName(path) {
  return `projects/${GCP_PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function firestoreCommit(env, writes) {
  const token = await getGoogleAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Falha ao gravar no Firestore: ' + JSON.stringify(data));
  return data;
}

// Grava a mensagem na subcoleção conversations/{phone}/messages e atualiza o
// "resumo" da conversa (última mensagem, direção, contador de não lidas).
async function saveConversationMessage(env, { phone, direction, body, type, status, waMessageId, senderName }) {
  const now = new Date().toISOString();
  const msgId = waMessageId || crypto.randomUUID();

  const conversationWrite = {
    update: {
      name: docName(`conversations/${phone}`),
      fields: fsFields({ phone, lastMessage: body || '', lastMessageAt: now, lastDirection: direction, updatedAt: now })
    },
    updateMask: { fieldPaths: ['phone', 'lastMessage', 'lastMessageAt', 'lastDirection', 'updatedAt'] }
  };
  if (direction === 'in') {
    conversationWrite.updateTransforms = [{ fieldPath: 'unreadCount', increment: { integerValue: '1' } }];
  }

  const messageWrite = {
    update: {
      name: docName(`conversations/${phone}/messages/${msgId}`),
      fields: fsFields({
        id: msgId,
        direction,
        body: body || '',
        type: type || 'text',
        status: status || (direction === 'in' ? 'received' : 'sent'),
        timestamp: now,
        ...(senderName ? { senderName } : {})
      })
    }
  };

  await firestoreCommit(env, [conversationWrite, messageWrite]);
  return msgId;
}

async function updateMessageStatus(env, recipientId, waMessageId, status) {
  const phone = cleanPhone(recipientId);
  try {
    await firestoreCommit(env, [
      {
        update: { name: docName(`conversations/${phone}/messages/${waMessageId}`), fields: fsFields({ status }) },
        updateMask: { fieldPaths: ['status'] },
        currentDocument: { exists: true }
      }
    ]);
  } catch (e) {
    // Corrida rara: o status chegou antes da própria mensagem terminar de ser
    // gravada (ou é de uma mensagem antiga, de antes do webhook existir).
    console.error('Não deu pra atualizar status da mensagem', waMessageId, e.message);
  }
}

/* ------------------------------------------------------------------ */
/* Webhook da Meta                                                     */
/* ------------------------------------------------------------------ */

function handleWebhookVerify(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

async function verifyMetaSignature(request, env, rawBody) {
  const signatureHeader = request.headers.get('X-Hub-Signature-256') || '';
  const expected = signatureHeader.replace('sha256=', '');
  if (!expected || !env.WHATSAPP_APP_SECRET) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.WHATSAPP_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function extractMessageBody(msg) {
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'button') return msg.button?.text || '[Botão]';
  if (msg.type === 'interactive') {
    return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Resposta interativa]';
  }
  return `[Mensagem de ${msg.type} recebida]`;
}

async function handleWebhookEvent(request, env) {
  const rawBody = await request.text();
  const isValid = await verifyMetaSignature(request, env, rawBody);
  if (!isValid) return new Response('Invalid signature', { status: 401 });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        for (const msg of value.messages || []) {
          const phone = cleanPhone(msg.from);
          const senderName = (value.contacts || [])[0]?.profile?.name;
          await saveConversationMessage(env, {
            phone,
            direction: 'in',
            body: extractMessageBody(msg),
            type: msg.type,
            status: 'received',
            waMessageId: msg.id,
            senderName
          });
        }

        for (const status of value.statuses || []) {
          await updateMessageStatus(env, status.recipient_id, status.id, status.status);
        }
      }
    }
  } catch (e) {
    // Mesmo com erro no processamento, respondemos 200 abaixo — senão a Meta
    // fica reenviando o mesmo evento indefinidamente.
    console.error('Erro processando evento do webhook:', e.message);
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
}

/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/webhook') {
      if (request.method === 'GET') return handleWebhookVerify(request, env);
      if (request.method === 'POST') return handleWebhookEvent(request, env);
      return json({ error: 'method_not_allowed' }, 405);
    }

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

    try {
      if (url.pathname === '/send-template') {
        const result = await callGraphApi(env.WHATSAPP_TOKEN, {
          messaging_product: 'whatsapp',
          to: cleanPhone(phone),
          type: 'template',
          template: { name: WELCOME_TEMPLATE_NAME, language: { code: TEMPLATE_LANGUAGE } }
        });
        const messageId = result?.messages?.[0]?.id || null;
        // ctx.waitUntil garante que essa gravação no Firestore termine mesmo
        // depois da resposta já ter sido enviada — sem isso, o Cloudflare pode
        // encerrar o Worker antes da gravação rodar, e a mensagem enviada
        // nunca aparece no histórico da conversa (só as recebidas apareciam).
        ctx.waitUntil(
          saveConversationMessage(env, {
            phone: cleanPhone(phone),
            direction: 'out',
            body: '[Modelo de boas-vindas "studio"]',
            type: 'template',
            status: 'sent',
            waMessageId: messageId
          }).catch((e) => console.error('Falha ao salvar template enviado na conversa:', e.message))
        );
        return json({ success: true, messageId });
      }

      if (url.pathname === '/send-text') {
        if (!message) return json({ error: 'invalid_argument', message: 'Mensagem é obrigatória.' }, 400);
        const result = await callGraphApi(env.WHATSAPP_TOKEN, {
          messaging_product: 'whatsapp',
          to: cleanPhone(phone),
          type: 'text',
          text: { body: message, preview_url: false }
        });
        const messageId = result?.messages?.[0]?.id || null;
        // Ver comentário acima sobre ctx.waitUntil.
        ctx.waitUntil(
          saveConversationMessage(env, {
            phone: cleanPhone(phone),
            direction: 'out',
            body: message,
            type: 'text',
            status: 'sent',
            waMessageId: messageId
          }).catch((e) => console.error('Falha ao salvar mensagem enviada na conversa:', e.message))
        );
        return json({ success: true, messageId });
      }

      if (url.pathname === '/send-document') {
        const filename = payload?.filename || 'documento.pdf';
        const base64Pdf = payload?.base64Pdf;
        const caption = payload?.caption || '';
        if (!base64Pdf) return json({ error: 'invalid_argument', message: 'Arquivo (base64Pdf) é obrigatório.' }, 400);

        const mediaId = await uploadMediaToGraphApi(env.WHATSAPP_TOKEN, base64Pdf, filename, 'application/pdf');
        const result = await callGraphApi(env.WHATSAPP_TOKEN, {
          messaging_product: 'whatsapp',
          to: cleanPhone(phone),
          type: 'document',
          document: { id: mediaId, filename, ...(caption ? { caption } : {}) }
        });
        const messageId = result?.messages?.[0]?.id || null;
        // Ver comentário acima sobre ctx.waitUntil.
        ctx.waitUntil(
          saveConversationMessage(env, {
            phone: cleanPhone(phone),
            direction: 'out',
            body: caption || `[Documento] ${filename}`,
            type: 'document',
            status: 'sent',
            waMessageId: messageId
          }).catch((e) => console.error('Falha ao salvar documento enviado na conversa:', e.message))
        );
        return json({ success: true, messageId });
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
