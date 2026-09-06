import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, User,
  Phone, Mail, Calendar, X, MoreVertical,
  ChevronRight, MessageSquare, Star,
  Clock, MapPin, ArrowRight, Send, CheckCircle2,
  Square, CheckSquare, Megaphone, Loader2, AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWhatsAppText, sendWhatsAppTemplate } from '../lib/whatsapp';
import { Client } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';

const DEFAULT_PROMO_MESSAGE = 'Oi {nome}! 💇‍♀️ Tenho uma novidade especial no Estúdio Alê essa semana, só pra você. Me chama aqui pra saber mais!';

type SendOutcome = 'text' | 'template' | 'error' | 'skipped';

interface SendResult {
  client: Client;
  outcome: SendOutcome;
  detail?: string;
}

// Chama o Cloudflare Worker (whatsapp-worker/) pra mandar texto livre; se o
// cliente estiver fora da janela de 24h, manda automaticamente o template de
// boas-vindas pra reabrir o contato. Ver src/lib/whatsapp.ts.
async function dispatchWhatsApp(client: Client, message: string): Promise<SendResult> {
  try {
    await sendWhatsAppText(client.phone, message);
    return { client, outcome: 'text' };
  } catch (err: any) {
    const isWindowClosed = err?.code === 'window_closed';
    if (!isWindowClosed) {
      return { client, outcome: 'error', detail: err?.message || 'Falha ao enviar.' };
    }
    try {
      await sendWhatsAppTemplate(client.phone);
      return { client, outcome: 'template' };
    } catch (err2: any) {
      return { client, outcome: 'error', detail: err2?.message || 'Falha ao enviar o template de boas-vindas.' };
    }
  }
}

export default function ClientManagement() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthDate: '',
    notes: ''
  });

  // --- Envio de promoção para vários clientes (WhatsApp via Meta Cloud API) ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoMessage, setPromoMessage] = useState(DEFAULT_PROMO_MESSAGE);
  const [promoStep, setPromoStep] = useState<'compose' | 'sending' | 'done'>('compose');
  const [promoIndex, setPromoIndex] = useState(0);
  const [promoClients, setPromoClients] = useState<Client[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return unsub;
  }, []);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const data = { ...formData, createdAt: new Date().toISOString() };
    if (editingClient) await updateDoc(doc(db, 'clients', editingClient.id), data);
    else await addDoc(collection(db, 'clients'), data);
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', birthDate: '', notes: '' });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(v => !v);
    setSelectedIds([]);
  };

  const toggleClientSelected = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    setSelectedIds(filteredClients.map(c => c.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const buildMessageFor = (client: Client) => {
    const firstName = (client.name || '').trim().split(' ')[0] || client.name;
    return promoMessage.replace(/\{nome\}/gi, firstName);
  };

  const openPromoModal = () => {
    const selected = clients.filter(c => selectedIds.includes(c.id));
    if (selected.length === 0) return;
    setPromoClients(selected);
    setPromoMessage(DEFAULT_PROMO_MESSAGE);
    setPromoStep('compose');
    setPromoIndex(0);
    setSendResults([]);
    setIsPromoModalOpen(true);
  };

  const removeFromPromoList = (id: string) => {
    setPromoClients(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  // Evita que o loop de envio continue depois que a pessoa clica em
  // "Cancelar Envio" no meio do lote.
  const cancelPromoRef = useRef(false);

  // Dispara pra TODOS os clientes selecionados em sequência, um atrás do
  // outro (com uma pequena pausa entre cada um pra não sobrecarregar a API
  // da Meta) — sem precisar confirmar um por um.
  const runBatchSend = async (list: Client[]) => {
    setIsSending(true);
    const results: SendResult[] = [];
    for (let i = 0; i < list.length; i++) {
      if (cancelPromoRef.current) {
        for (let j = i; j < list.length; j++) {
          results.push({ client: list[j], outcome: 'skipped' });
        }
        break;
      }
      setPromoIndex(i);
      const result = await dispatchWhatsApp(list[i], buildMessageFor(list[i]));
      results.push(result);
      setSendResults([...results]);
      if (i < list.length - 1 && !cancelPromoRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    setIsSending(false);
    setPromoStep('done');
  };

  const startPromoSending = () => {
    if (promoClients.length === 0 || !promoMessage.trim()) return;
    setPromoIndex(0);
    setSendResults([]);
    setPromoStep('sending');
    cancelPromoRef.current = false;
    runBatchSend(promoClients);
  };

  const cancelPromoSending = () => {
    cancelPromoRef.current = true;
  };

  const finishPromo = () => {
    cancelPromoRef.current = false;
    setIsPromoModalOpen(false);
    setSelectionMode(false);
    setSelectedIds([]);
    setPromoClients([]);
    setPromoStep('compose');
    setPromoIndex(0);
    setSendResults([]);
  };

  const sendSingleMessage = async (client: Client) => {
    if (sendingSingleId) return;
    setSendingSingleId(client.id);
    const firstName = (client.name || '').trim().split(' ')[0] || client.name;
    const message = `Oi ${firstName}! Tudo bem? Aqui é do Estúdio Alê 💕`;
    const result = await dispatchWhatsApp(client, message);
    setSendingSingleId(null);
    if (result.outcome === 'text') {
      alert(`Mensagem enviada para ${client.name}!`);
    } else if (result.outcome === 'template') {
      alert(`${client.name} não conversou com a gente nas últimas 24h — mandei a mensagem de boas-vindas pra reabrir o contato. Quando ela responder, dá pra mandar mensagens livres.`);
    } else {
      alert(`Não foi possível enviar para ${client.name}: ${result.detail}`);
    }
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
           <h2 className="text-3xl font-display font-semibold text-slate-800 tracking-tight">Gestão de Clientes</h2>
           <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">Sua base de dados premium.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={toggleSelectionMode}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-semibold uppercase tracking-widest transition-all shadow-sm active:scale-95",
              selectionMode ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-pink-50 text-[#C15F76] hover:bg-[#E38EA0] hover:text-white"
            )}
          >
            <Megaphone className="w-4 h-4" /> {selectionMode ? 'Cancelar Seleção' : 'Enviar Promoção'}
          </button>
          {isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-5 h-5" /> Novo Cliente
            </button>
          )}
        </div>
      </header>

      {/* BARRA DE SELEÇÃO PARA ENVIO EM MASSA */}
      {selectionMode && (
        <div className="card-premium px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-pink-100 bg-pink-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E38EA0] text-white flex items-center justify-center font-semibold text-sm shrink-0">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Cliente{selectedIds.length === 1 ? '' : 's'} selecionado{selectedIds.length === 1 ? '' : 's'}</p>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Toque nos cartões para escolher quem recebe a promoção.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={selectAllFiltered} className="flex-1 sm:flex-none text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 bg-white transition-all active:scale-95">
              Selecionar Todos
            </button>
            <button onClick={clearSelection} className="flex-1 sm:flex-none text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 bg-white transition-all active:scale-95">
              Limpar
            </button>
            <button
              onClick={openPromoModal}
              disabled={selectedIds.length === 0}
              className="flex-1 sm:flex-none btn-primary !py-2.5 !px-5 text-[11px] disabled:opacity-40 disabled:pointer-events-none"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="relative group">
         <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center">
            <Search className="w-5 h-5 text-[#E38EA0]" />
         </div>
         <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="input-premium pl-16 pr-6 !py-4 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredClients.map(client => {
          const isSelected = selectedIds.includes(client.id);
          const isSendingThis = sendingSingleId === client.id;
          return (
          <div
            key={client.id}
            onClick={() => { if (selectionMode) toggleClientSelected(client.id); }}
            className={cn(
              "card-premium p-8 relative flex flex-col justify-between min-h-[250px] group transition-all",
              selectionMode && "cursor-pointer",
              isSelected && "ring-2 ring-[#E38EA0] ring-offset-2 ring-offset-[#FBF7F6]"
            )}
          >
             {selectionMode && (
               <div className="absolute -top-3 -left-3 w-8 h-8 rounded-xl bg-white shadow-md border border-pink-100 flex items-center justify-center text-[#E38EA0] z-10">
                 {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
               </div>
             )}
             <div>
                <div className="flex justify-between items-start mb-6">
                   <div className="w-16 h-16 bg-[#FBF7F6] rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm text-[#E38EA0] font-semibold text-2xl uppercase transition-transform group-hover:scale-105">
                      {client.name[0]}
                   </div>
                   <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); sendSingleMessage(client); }}
                        disabled={isSendingThis}
                        title="Enviar mensagem no WhatsApp"
                        className="p-2.5 bg-pink-50 text-[#E38EA0] rounded-xl hover:bg-[#E38EA0] hover:text-white transition-all shadow-sm disabled:opacity-50"
                      >
                        {isSendingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                      </button>
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); setFormData({ ...client }); setIsModalOpen(true); }} className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-xl transition-all border border-slate-100 shadow-sm active:scale-90"><Edit3 className="w-4 h-4" /></button>
                      )}
                   </div>
                </div>

                <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight mb-2 truncate">{client.name}</h3>

                <div className="space-y-3">
                   <div className="flex items-center gap-3 text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-pink-200" />
                      <span className="text-xs font-bold">{client.phone}</span>
                   </div>
                   {client.email && (
                     <div className="flex items-center gap-3 text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-pink-200" />
                        <span className="text-xs font-bold truncate max-w-[200px]">{client.email}</span>
                     </div>
                   )}
                </div>
             </div>

             <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between font-sans">
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-amber-500" />
                   <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Nasc: {client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : '--'}</span>
                </div>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'clients', client.id)); }} className="text-red-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                )}
             </div>
          </div>
          );
        })}
      </div>

      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-5xl w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold text-slate-800 uppercase tracking-tight leading-none">{editingClient ? 'Editar' : 'Novo'} Cliente</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Cadastro premium para studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Nome Completo</label>
                  <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="Ex: Maria Alexandra" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Telefone/Zap</label>
                    <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="(11) 99999-9999" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Data Nasc.</label>
                    <input type="date" className="input-premium !py-2.5 !px-5 shadow-sm uppercase font-semibold !text-[10px]" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                </div>
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Email Secundário</label>
                  <input type="email" className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="cliente@email.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="relative pt-1.5 font-sans mb-4">
                   <label className="label-premium !text-[9px] !mb-1.5">Observações / Preferências</label>
                   <textarea className="textarea-premium !h-24 shadow-inner" placeholder="Preferências, alergias ou observações técnicas..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                </div>
                <button type="submit" className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-widest font-semibold group shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                   Finalizar Cadastro <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENVIO DE PROMOÇÃO PARA VÁRIOS CLIENTES */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isSending && setIsPromoModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-5xl w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              {!isSending && (
                <button onClick={() => setIsPromoModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              )}

              {promoStep === 'compose' && (
                <>
                  <div className="mb-6 shrink-0 pr-8">
                    <h3 className="text-xl md:text-2xl font-semibold text-slate-800 uppercase tracking-tight leading-none">Enviar Promoção</h3>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">
                      {promoClients.length} cliente{promoClients.length === 1 ? '' : 's'} selecionado{promoClients.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative pt-1.5 font-sans">
                      <label className="label-premium !text-[9px] !mb-1.5">Mensagem</label>
                      <textarea
                        className="textarea-premium !h-32 shadow-inner"
                        value={promoMessage}
                        onChange={(e) => setPromoMessage(e.target.value)}
                        placeholder="Escreva a mensagem da promoção..."
                      />
                      <p className="text-[10px] text-slate-400 font-semibold mt-1.5 px-1">
                        Use <span className="text-[#C15F76] font-bold">{'{nome}'}</span> para inserir o primeiro nome de cada cliente automaticamente.
                      </p>
                    </div>

                    <div>
                      <label className="label-premium !text-[9px] !mb-1.5">Destinatários</label>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {promoClients.map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-[#FBF7F6] rounded-xl px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{c.phone}</p>
                            </div>
                            <button onClick={() => removeFromPromoList(c.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed px-1">
                      O envio é direto pelo sistema, sem precisar abrir o WhatsApp. Se algum cliente não tiver
                      conversado com você nas últimas 24h, a Meta exige mandar antes a mensagem de boas-vindas —
                      o sistema faz isso sozinho e avisa quem ficou nessa situação, pra você saber quem ainda
                      precisa responder antes de receber a promoção.
                    </p>

                    <button
                      onClick={startPromoSending}
                      disabled={promoClients.length === 0 || !promoMessage.trim()}
                      className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-widest font-semibold group shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Iniciar Envio <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {promoStep === 'sending' && promoClients[promoIndex] && (
                <>
                  <div className="mb-6 shrink-0 pr-8">
                    <h3 className="text-xl md:text-2xl font-semibold text-slate-800 uppercase tracking-tight leading-none">Enviando Promoção</h3>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">
                      Cliente {Math.min(sendResults.length + 1, promoClients.length)} de {promoClients.length}
                    </p>
                  </div>

                  <div className="w-full h-1.5 bg-pink-50 rounded-full overflow-hidden mb-6">
                    <div
                      className="h-full bg-[#E38EA0] transition-all"
                      style={{ width: `${(sendResults.length / promoClients.length) * 100}%` }}
                    />
                  </div>

                  <div className="bg-[#FBF7F6] rounded-3xl p-6 mb-5">
                    <p className="text-lg font-semibold text-slate-800">{promoClients[promoIndex].name}</p>
                    <p className="text-xs font-bold text-slate-400 mb-3">{promoClients[promoIndex].phone}</p>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{buildMessageFor(promoClients[promoIndex])}</p>
                  </div>

                  <div className="flex items-center justify-center gap-3 text-slate-400 text-xs font-semibold uppercase tracking-widest mb-5">
                    <Loader2 className="w-4 h-4 animate-spin text-[#E38EA0]" />
                    Enviando automaticamente...
                  </div>

                  <div className="flex gap-3">
                    <button onClick={cancelPromoSending} disabled={!isSending} className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-700 px-4 py-3.5 rounded-2xl border border-slate-200 bg-white transition-all active:scale-95 disabled:opacity-40">
                      Cancelar Envio
                    </button>
                  </div>
                </>
              )}

              {promoStep === 'done' && (() => {
                const sentDirect = sendResults.filter(r => r.outcome === 'text');
                const sentTemplate = sendResults.filter(r => r.outcome === 'template');
                const failed = sendResults.filter(r => r.outcome === 'error');
                const skipped = sendResults.filter(r => r.outcome === 'skipped');
                return (
                  <div className="text-center py-2">
                    <div className="w-16 h-16 rounded-full bg-pink-50 text-[#E38EA0] flex items-center justify-center mb-5 mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight mb-2">Promoção concluída</h3>
                    <p className="text-slate-400 text-sm mb-6">Você percorreu todos os {promoClients.length} clientes selecionados.</p>

                    <div className="space-y-3 text-left mb-8">
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3">
                        <span className="text-xs font-semibold text-emerald-700">Promoção enviada direto</span>
                        <span className="text-sm font-bold text-emerald-700">{sentDirect.length}</span>
                      </div>
                      {sentTemplate.length > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Só recebeu boas-vindas (aguardando resposta)</span>
                            <span className="text-sm font-bold text-amber-700">{sentTemplate.length}</span>
                          </div>
                          <p className="text-[10px] text-amber-600 font-semibold mt-2">{sentTemplate.map(r => r.client.name).join(', ')}</p>
                        </div>
                      )}
                      {failed.length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-red-600">Falhou</span>
                            <span className="text-sm font-bold text-red-600">{failed.length}</span>
                          </div>
                          <p className="text-[10px] text-red-500 font-semibold mt-2">{failed.map(r => r.client.name).join(', ')}</p>
                        </div>
                      )}
                      {skipped.length > 0 && (
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3">
                          <span className="text-xs font-semibold text-slate-500">Pulados</span>
                          <span className="text-sm font-bold text-slate-500">{skipped.length}</span>
                        </div>
                      )}
                    </div>

                    <button onClick={finishPromo} className="btn-primary !px-10">
                      Concluir
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
