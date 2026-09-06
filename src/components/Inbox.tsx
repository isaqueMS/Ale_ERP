import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Send, Loader2, MessageCircle, Check, CheckCheck,
  Clock, AlertTriangle, User, ArrowLeft
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWhatsAppText, sendWhatsAppTemplate } from '../lib/whatsapp';
import { Client } from '../types';
import { cn, phonesMatch, formatPhone } from '../lib/utils';
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
}

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
        <p className="text-slate-400 text-sm mt-1">Converse direto com os clientes pelo WhatsApp.</p>
      </header>

      <div className="flex-1 min-h-0 card-premium flex overflow-hidden">
        {/* LISTA DE CONVERSAS */}
        <div className={cn(
          "w-full sm:w-[320px] shrink-0 border-r border-slate-100 flex flex-col",
          selectedPhone ? "hidden sm:flex" : "flex"
        )}>
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                className="input-premium pl-11 !py-2.5 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="p-8 text-center">
                <MessageCircle className="w-10 h-10 text-pink-100 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest leading-relaxed">
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
                  <div className="w-11 h-11 rounded-2xl bg-pink-50 border border-white shadow-sm flex items-center justify-center shrink-0 text-primary font-bold uppercase">
                    {client ? client.name[0] : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-700 truncate">{client?.name || formatPhone(conv.phone)}</p>
                      <span className="text-[10px] font-semibold text-slate-300 shrink-0">{relativeLabel(conv.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        {conv.lastDirection === 'out' ? 'Você: ' : ''}{conv.lastMessage}
                      </p>
                      {!!conv.unreadCount && (
                        <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0">
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
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300 p-8">
              <MessageCircle className="w-16 h-16" />
              <p className="text-xs font-bold uppercase tracking-widest text-center">Escolha uma conversa ao lado<br />pra ver as mensagens.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button onClick={() => setSelectedPhone(null)} className="sm:hidden p-2 -ml-2 text-slate-400">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-pink-50 border border-white shadow-sm flex items-center justify-center shrink-0 text-primary font-bold uppercase">
                  {selectedClient ? selectedClient.name[0] : <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{selectedClient?.name || 'Contato sem cadastro'}</p>
                  <p className="text-[11px] text-slate-400">{formatPhone(selectedConversation.phone)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FFFDFB]">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.direction === 'out' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      "max-w-[75%] sm:max-w-[60%] rounded-2xl px-4 py-2.5 shadow-sm",
                      msg.direction === 'out' ? "bg-primary text-white rounded-br-md" : "bg-white border border-slate-100 text-slate-700 rounded-bl-md"
                    )}>
                      <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1 justify-end",
                        msg.direction === 'out' ? "text-white/70" : "text-slate-300"
                      )}>
                        <span className="text-[10px] font-medium">{relativeLabel(msg.timestamp)}</span>
                        {msg.direction === 'out' && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-100 shrink-0">
                {sendError && (
                  <div className="mb-3 bg-amber-50 text-amber-600 text-xs font-semibold p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-tight">{sendError}</p>
                  </div>
                )}
                <div className="flex items-end gap-2">
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
                    className="btn-primary !rounded-2xl h-12 w-12 shrink-0 !px-0 disabled:opacity-50"
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
    </div>
  );
}
