/**
 * Cloud Functions para disparo de mensagens de WhatsApp via Meta Cloud API,
 * usadas pela tela "Enviar Promoção" do app (src/components/ClientManagement.tsx).
 *
 * Fluxo:
 *  - sendWhatsAppText: manda texto livre (mensagem personalizada da promoção).
 *    Só funciona se o cliente respondeu alguma mensagem nas últimas 24h
 *    (regra da Meta). Se a janela estiver fechada, lança o erro especial
 *    "window_closed" para o front-end tentar sendWhatsAppTemplate.
 *  - sendWhatsAppTemplate: manda o template aprovado "studio" (boas-vindas).
 *    Serve para reabrir a janela de 24h com clientes que não conversam há
 *    um tempo — depois que a cliente responder, dá para mandar texto livre.
 *
 * IMPORTANTE — antes de dar deploy:
 *  1. Rode `firebase functions:secrets:set WHATSAPP_TOKEN` e cole o access
 *     token permanente (nunca commitar o token no código).
 *  2. Confira TEMPLATE_LANGUAGE abaixo — a Meta mostra "English" na listagem,
 *     mas o código pode ser "en" ou "en_US". Se o envio do template falhar
 *     com erro de idioma/template não encontrado, troque o valor abaixo.
 *  3. O projeto Firebase precisa estar no plano Blaze (Functions só fazem
 *     chamada de rede externa nesse plano).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');

const PHONE_NUMBER_ID = '1056793024186250';
const GRAPH_API_VERSION = 'v20.0';
const WELCOME_TEMPLATE_NAME = 'studio';
// Ajuste para 'en_US' se a Meta recusar dizendo que o template/idioma não existe.
const TEMPLATE_LANGUAGE = 'en';

function cleanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Garante o DDI do Brasil (55) na frente, sem duplicar caso já venha com ele.
  if (digits.length > 11 && digits.startsWith('55')) return digits;
  return `55${digits}`;
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || 'Erro ao chamar a API da Meta');
    err.metaError = json?.error || null;
    throw err;
  }
  return json;
}

function assertAuthenticated(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É preciso estar autenticado.');
  }
}

// Erro 131047 = "Re-engagement message": mais de 24h desde a última
// mensagem recebida desse cliente. É o sinal de "janela fechada".
function isWindowClosedError(metaError) {
  return !!metaError && (metaError.code === 131047 || metaError.error_subcode === 2018278);
}

exports.sendWhatsAppTemplate = onCall({ secrets: [WHATSAPP_TOKEN] }, async (request) => {
  assertAuthenticated(request);
  const phone = request.data?.phone;
  if (!phone) {
    throw new HttpsError('invalid-argument', 'Telefone é obrigatório.');
  }

  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone(phone),
    type: 'template',
    template: {
      name: WELCOME_TEMPLATE_NAME,
      language: { code: TEMPLATE_LANGUAGE }
    }
  };

  try {
    const result = await callGraphApi(WHATSAPP_TOKEN.value(), body);
    return { success: true, messageId: result?.messages?.[0]?.id || null };
  } catch (error) {
    throw new HttpsError('internal', error.message, error.metaError || null);
  }
});

exports.sendWhatsAppText = onCall({ secrets: [WHATSAPP_TOKEN] }, async (request) => {
  assertAuthenticated(request);
  const phone = request.data?.phone;
  const message = request.data?.message;
  if (!phone || !message) {
    throw new HttpsError('invalid-argument', 'Telefone e mensagem são obrigatórios.');
  }

  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone(phone),
    type: 'text',
    text: { body: message, preview_url: false }
  };

  try {
    const result = await callGraphApi(WHATSAPP_TOKEN.value(), body);
    return { success: true, messageId: result?.messages?.[0]?.id || null };
  } catch (error) {
    if (isWindowClosedError(error.metaError)) {
      // Mensagem especial "window_closed": o front-end reconhece esse texto
      // e tenta automaticamente sendWhatsAppTemplate em seguida.
      throw new HttpsError('failed-precondition', 'window_closed', error.metaError);
    }
    throw new HttpsError('internal', error.message, error.metaError || null);
  }
});
