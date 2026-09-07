import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Send, Loader2, MessageCircle, Check, CheckCheck,
  Clock, AlertTriangle, User, ArrowLeft, Plus, X, Smile
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWhatsAppText, sendWhatsAppTemplate } from '../lib/whatsapp';
import { Client } from '../types';
import { cn, phonesMatch, formatPhone, normalizePhoneForWhatsApp } from '../lib/utils';
import SearchableSelect from './SearchableSelect';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

interface Conversation {
  id: string; // telefone normalizado (chave do documento)
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: 'in' | 'out';
  unreadCount?: number;
}

interface Message {
  id: string;
  direction: 'in' | 'out';
  body: string;
  type: string;
  status: string;
  timestamp: string;
  senderName?: string;
  statusError?: string;
  caption?: string;
}

// Conjunto curado de emojis mais usados num salão — evita depender de uma
// lib externa de emoji picker só pra isso.
const EMOJI_OPTIONS = [
  '😊', '😍', '🥰', '😘', '😉', '🤗', '🙏', '👏',
  '👍', '💪', '✨', '🎉', '💕', '💖', '💅', '💇‍♀️',
  '💇', '💄', '✂️', '🧴', '🌸', '🌷', '🎀', '⭐',
  '🔥', '❤️', '😅', '🙌', '📅', '⏰', '✅', '📸'
];

function relativeLabel(iso: string) {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Ontem';
    return format(d, 'dd/MM/yy');
  } catch {
    return '';
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-white/60" />;
  if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-300" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-white/60" />;
  return <Clock className="w-3.5 h-3.5 text-white/40" />;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setConversations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'conversations', selectedPhone, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clientByPhone = useMemo(() => {
    return (phone: string) => clients.find((c) => phonesMatch(c.phone, phone));
  }, [clients]);

  const filteredConversations = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return conversations.filter((conv) => {
      const client = clientByPhone(conv.phone);
      const name = client?.name || conv.phone;
      return name.toLowerCase().includes(term) || conv.phone.includes(term);
    });
  }, [conversations, searchTerm, clientByPhone]);

  const selectedConversation = conversations.find((c) => c.id === selectedPhone) || null;
  const selectedClient = selectedPhone ? clientByPhone(selectedPhone) : null;

  // Começa uma conversa nova com uma cliente que ainda não tem histórico —
  // antes só dava pra conversar com quem já tinha uma conversa existente no
  // Firestore (ou seja, quem já tinha mandado ou recebido mensagem antes).
  // O id usado aqui precisa bater com o que o Worker gera quando a mensagem
  // é de fato enviada, por isso a mesma normalização (normalizePhoneForWhatsApp).
  const startNewConversation = (client: Client) => {
    setSelectedPhone(normalizePhoneForWhatsApp(client.phone));
    setSendError('');
    setDraft('');
    setIsNewChatOpen(false);
  };

  const openConversation = async (conv: Conversation) => {
    setSelectedPhone(conv.id);
    setSendError('');
    if (conv.unreadCount) {
      try {
        await updateDoc(doc(db, 'conversations', conv.id), { unreadCount: 0 });
      } catch {
        // Não é crítico se isso falhar — só afeta o contador de não lidas.
      }
    }
  };

  const insertEmoji = (emoji: string) => {
    setDraft((prev) => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selectedPhone || sending) return;
    setSending(true);
    setSendError('');
    try {
      await sendWhatsAppText(selectedPhone, text);
      setDraft('');
    } catch (err: any) {
      if (err?.code === 'window_closed') {
        try {
          await sendWhatsAppTemplate(selectedPhone);
          setSendError('Já fazia mais de 24h desde a última mensagem do cliente — mandamos o modelo de boas-vindas pra reabrir a conversa. Depois que ele responder, você pode mandar texto livre de novo.');
          setDraft('');
        } catch (err2: any) {
          setSendError(err2?.message || 'Falha ao enviar o modelo de boas-vindas.');
        }
      } else {
        setSendError(err?.message || 'Falha ao enviar mensagem.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] sm:h-[calc(100vh-120px)] flex flex-col animate-fade-up">
      <header className="mb-4 sm:mb-6 shrink-0">
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-slate-800 tracking-tight">Caixa de Entrada</h2>
        <p className="text-slate-600 text-sm mt-1">Converse direto com os clientes pelo WhatsApp.</p>
      </header>

      <div className="flex-1 min-h-0 card-premium flex overflow-hidden">
        {/* LISTA DE CONVERSAS */}
        <div className={cn(
          "w-full sm:w-[320px] shrink-0 border-r border-slate-100 flex flex-col",
          selectedPhone ? "hidden sm:flex" : "flex"
        )}>
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                className="input-premium pl-11 !py-2.5 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsNewChatOpen(true)}
              className="w-10 h-10 shrink-0 rounded-xl bg-primary-deep text-white flex items-center justify-center shadow-sm hover:bg-primary-dark transition-all active:scale-95"
              title="Nova conversa"
              aria-label="Nova conversa"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="p-8 text-center">
                <MessageCircle className="w-10 h-10 text-pink-200 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Nenhuma conversa ainda.<br />Assim que alguém escrever, aparece aqui.
                </p>
              </div>
            )}
            {filteredConversations.map((conv) => {
              const client = clientByPhone(conv.phone);
              const isActive = conv.id === selectedPhone;
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={cn(
                    "w-full text-left px-4 py-3.5 flex items-center gap-3 border-b border-slate-50 transition-colors",
                    isActive ? "bg-pink-50" : "hover:bg-[#FFFDFB]"
                  )}
                >
                  <div className="w-11 h-11 rounded-2xl bg-pink-50 border border-white shadow-sm flex items-center justify-center shrink-0 text-primary-deep font-bold uppercase">
                    {client ? client.name[0] : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{client?.name || formatPhone(conv.phone)}</p>
                      <span className="text-[10px] font-semibold text-slate-500 shrink-0">{relativeLabel(conv.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-slate-600 truncate">
                        {conv.lastDirection === 'out' ? 'Você: ' : ''}{conv.lastMessage}
                      </p>
                      {!!conv.unreadCount && (
                        <span className="text-[10px] font-bold text-white bg-primary-deep rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* THREAD DA CONVERSA */}
        <div className={cn("flex-1 min-w-0 flex flex-col", selectedPhone ? "flex" : "hidden sm:flex")}>
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <MessageCircle className="w-16 h-16 text-slate-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-center text-slate-500">Escolha uma conversa ao lado<br />pra ver as mensagens.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button onClick={() => setSelectedPhone(null)} className="sm:hidden p-2 -ml-2 text-slate-400">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-pink-50 border border-white shadow-sm flex items-center justify-center shrink-0 text-primary-deep font-bold uppercase">
                  {selectedClient ? selectedClient.name[0] : <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{selectedClient?.name || 'Contato sem cadastro'}</p>
                  <p className="text-[11px] text-slate-600">{formatPhone(selectedConversation?.phone || selectedPhone)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FFFDFB]">
                {messages.map((msg) => {
                  const isImage = msg.type === 'image' && msg.body?.startsWith('data:image');
                  return (
                    <div key={msg.id} className={cn("flex flex-col", msg.direction === 'out' ? 'items-end' : 'items-start')}>
                      <div className={cn(
                        "max-w-[75%] sm:max-w-[60%] rounded-2xl shadow-sm",
                        isImage ? "p-1.5" : "px-4 py-2.5",
                        msg.direction === 'out' ? "bg-primary-deep text-white rounded-br-md" : "bg-white border border-slate-100 text-slate-800 rounded-bl-md"
                      )}>
                        {isImage ? (
                          <>
                            <img
                              src={msg.body}
                              alt={msg.caption || 'Imagem enviada pela cliente'}
                              className="rounded-xl max-w-full max-h-72 object-cover"
                            />
                            {msg.caption && (
                              <p className={cn("text-sm leading-snug whitespace-pre-wrap break-words px-2 pt-2", msg.direction === 'out' ? "text-white" : "text-slate-800")}>
                                {msg.caption}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
                        )}
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1 justify-end",
                          isImage && "px-2 pb-1",
                          msg.direction === 'out' ? "text-white/85" : "text-slate-500"
                        )}>
                          <span className="text-[10px] font-medium">{relativeLabel(msg.timestamp)}</span>
                          {msg.direction === 'out' && <StatusIcon status={msg.status} />}
                        </div>
                      </div>
                      {/* Motivo da falha, quando a Meta manda um (webhook de status) — sem
                          isso só sabíamos que tinha falhado, nunca o porquê. */}
                      {msg.direction === 'out' && msg.status === 'failed' && msg.statusError && (
                        <p className="max-w-[75%] sm:max-w-[60%] text-[10px] text-red-500 font-semibold mt-1 text-right leading-snug">
                          Falha na entrega: {msg.statusError}
                        </p>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-100 shrink-0">
                {sendError && (
                  <div className="mb-3 bg-amber-50 text-amber-600 text-xs font-semibold p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-tight">{sendError}</p>
                  </div>
                )}
                <div className="flex items-end gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen((v) => !v)}
                    className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 text-slate-500 hover:text-primary-deep hover:border-pink-200 transition-all flex items-center justify-center active:scale-95"
                    aria-label="Inserir emoji"
                    title="Inserir emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  {isEmojiPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsEmojiPickerOpen(false)} />
                      <div className="absolute left-0 bottom-full mb-2 z-40 bg-white rounded-2xl shadow-card border border-slate-100 p-3 grid grid-cols-8 gap-1 w-72 animate-fade-up">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-pink-50 transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <textarea
                    className="input-premium flex-1 resize-none !py-3 text-sm"
                    rows={1}
                    placeholder="Escreva uma mensagem..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="btn-primary !bg-primary-deep hover:!bg-primary-dark !rounded-2xl h-12 w-12 shrink-0 !px-0 disabled:opacity-50"
                    aria-label="Enviar mensagem"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: NOVA CONVERSA — escolher uma cliente (com ou sem histórico) pra começar/retomar a conversa */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsNewChatOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 relative z-10 animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold text-slate-800">Nova conversa</h3>
                <button onClick={() => setIsNewChatOpen(false)} className="p-1.5 text-slate-300 hover:text-slate-600 transition-all" aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-4">Escolha a cliente pra começar a conversa — funciona mesmo se ainda não trocou nenhuma mensagem com ela.</p>
              <SearchableSelect
                options={clients.map((c) => ({ value: c.id, label: c.name, sublabel: formatPhone(c.phone) }))}
                value=""
                onChange={(clientId) => {
                  const client = clients.find((c) => c.id === clientId);
                  if (client) startNewConversation(client);
                }}
                placeholder="Selecionar cliente"
                searchPlaceholder="Buscar por nome..."
                emptyMessage="Nenhuma cliente encontrada."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
