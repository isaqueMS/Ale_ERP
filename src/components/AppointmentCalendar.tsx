import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, User, Scissors,
  Plus, ChevronLeft, ChevronRight, Check, X,
  Search, Filter, MoreVertical, Edit2, Trash2,
  ArrowRight as LucideArrowRight, Flag, Eye, FileText
} from 'lucide-react';
import {
  collection, query, onSnapshot, addDoc,
  deleteDoc, doc, updateDoc, orderBy, getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  format, startOfToday, addDays,
  isSameDay, parseISO, isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, Client, Staff, Service } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { PAYMENT_METHODS } from '../constants';
import ServiceReceiptModal from './ServiceReceiptModal';
import EmptyState from './EmptyState';
import { Skeleton } from './Skeleton';
import SearchableSelect from './SearchableSelect';

export default function AppointmentCalendar() {
  const { user: currentUser, profile, isAdmin, isAgente } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [markerFilter, setMarkerFilter] = useState('all');
  const [payingAppointmentId, setPayingAppointmentId] = useState<string | null>(null);
  const [receiptAppointmentId, setReceiptAppointmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    clientId: '',
    staffId: '',
    service: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: '',
    price: 0,
    marker: '',
    status: 'scheduled',
    paymentMethod: ''
  });

  useEffect(() => {
    const unsubA = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setIsLoading(false);
    });
    const unsubC = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    const unsubS = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });
    const unsubSer = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    if (currentUser?.uid && !isAdmin) {
      setStaffFilter(currentUser.uid);
    }

    return () => { unsubA(); unsubC(); unsubS(); unsubSer(); };
  }, [currentUser, isAdmin]);

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filteredAppointments = appointments.filter(a => {
    try {
      const client = clients.find(c => c.id === a.clientId);
      const staffMember = staff.find(s => s.id === a.staffId);

      const searchStr = `${client?.name} ${a.service} ${staffMember?.name} ${format(parseISO(a.date), 'dd/MM/yyyy HH:mm')}`.toLowerCase();
      const matchesSearch = !searchTerm || searchStr.includes(searchTerm.toLowerCase());

      const matchesStaff = staffFilter === 'all' || a.staffId === staffFilter;
      const matchesMarker = markerFilter === 'all' || (markerFilter === 'none' ? !a.marker : a.marker === markerFilter);

      return matchesSearch && matchesStaff && matchesMarker;
    } catch (e) {
      return false;
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const openNewModal = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0);

    const currentStaffMember = !isAdmin ? staff.find(s => s.email === currentUser?.email) : null;

    setFormData({
      clientId: '',
      staffId: currentStaffMember?.id || '',
      service: '',
      date: format(d, "yyyy-MM-dd'T'HH:mm"),
      notes: '',
      price: 0,
      marker: '',
      status: 'scheduled',
      paymentMethod: ''
    });
    setEditingAppointment(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedService = services.find(s => s.name === formData.service);
      const selectedStaff = staff.find(s => s.id === formData.staffId);

      const price = Number(formData.price) || selectedService?.price || 0;
      const commissionAmount = selectedService && selectedStaff
        ? (price * (Number(selectedStaff.commission) / 100))
        : 0;

      // Só admin pode definir/alterar o status diretamente no formulário
      // (ver também updateStatus, que já tinha essa checagem). Sem isso, um
      // não-admin podia criar um agendamento novo já como "completed" e
      // gerar um lançamento financeiro sem passar pelo fluxo de aprovação.
      const status = isAdmin ? formData.status : (editingAppointment?.status || 'scheduled');

      const data = {
        ...formData,
        status,
        price: Number(price),
        commissionAmount: Number(commissionAmount),
        createdAt: editingAppointment?.createdAt || new Date().toISOString()
      };

      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), data);
        if (data.status === 'completed' && editingAppointment.status !== 'completed') {
           await createTransactionForAppointment(editingAppointment.id, data);
        }
      } else {
        const docRef = await addDoc(collection(db, 'appointments'), data);
        if (data.status === 'completed') {
           await createTransactionForAppointment(docRef.id, data);
        }
      }

      setIsModalOpen(false);
      setEditingAppointment(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Erro ao salvar agendamento.');
    }
  };

  const createTransactionForAppointment = async (id: string, appt: any) => {
    const client = clients.find(c => c.id === appt.clientId);
    const staffMember = staff.find(s => s.id === appt.staffId);

    await addDoc(collection(db, 'transactions'), {
      type: 'income',
      category: 'Serviço Estúdio',
      amount: Number(appt.price),
      description: `Finalizado: ${appt.service} | Profis: ${staffMember?.name || 'Indef.'} | Cliente: ${client?.name || 'Indef.'}`,
      date: format(new Date(), 'yyyy-MM-dd'),
      creatorId: currentUser?.uid || 'system',
      creatorName: profile?.name || currentUser?.displayName || 'Studio Alexandra',
      professionalId: appt.staffId,
      appointmentId: id,
      paymentMethod: appt.paymentMethod || '',
      createdAt: new Date().toISOString()
    });
  };

  const updateStatus = async (id: string, status: 'completed' | 'cancelled', paymentMethod?: string) => {
    try {
      const appt = appointments.find(a => a.id === id);
      if (!appt) return;
      if (!isAdmin) return; // Só admin move status
      if (status === 'completed' && appt.status !== 'completed') {
        await createTransactionForAppointment(id, { ...appt, paymentMethod: paymentMethod || appt.paymentMethod });
      }
      await updateDoc(doc(db, 'appointments', id), { status, ...(paymentMethod ? { paymentMethod } : {}) });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Falha ao atualizar status do agendamento.");
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Tem certeza que deseja excluir este agendamento permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      setIsModalOpen(false);
      setEditingAppointment(null);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Falha ao excluir agendamento.");
    }
  };

  const availableServices = services.filter(s => {
    const selectedStaff = staff.find(st => st.id === formData.staffId);
    if (!formData.staffId) return true;
    if (selectedStaff?.role === 'admin') return true;
    const categories = selectedStaff?.enabledCategories || [];
    if (categories.length === 0) return true;
    return categories.includes(s.category || '');
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleServiceChange = (serviceName: string) => {
    const selectedService = services.find(s => s.name === serviceName);
    setFormData(prev => ({
      ...prev,
      service: serviceName,
      price: selectedService?.price || 0
    }));
  };

  const payingAppointment = payingAppointmentId ? appointments.find(a => a.id === payingAppointmentId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-up">
      {/* Header Inbox-style */}
      <header className="bg-white border-b border-slate-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
           <CalendarIcon className="w-8 h-8 text-[#E38EA0]" />
           <div>
              <h2 className="text-2xl font-display font-semibold text-slate-800 tracking-tight">Caixa de Agendamentos</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{filteredAppointments.length} atendimentos encontrados</p>
           </div>
        </div>

        <div className="flex-1 max-w-2xl px-4">
          <div className="relative group">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#E38EA0] transition-colors" />
             <input
               type="text"
               placeholder="Pesquisar por cliente, profissional, serviço ou data..."
               className="w-full bg-slate-50 border-0 rounded-2xl pl-14 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-pink-100 transition-all shadow-inner"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>

        <button onClick={openNewModal} className="btn-primary flex items-center gap-3 px-8 h-14 rounded-2xl shadow-xl shadow-pink-100">
           <Plus className="w-5 h-5" /> NOVO AGENDAMENTO
        </button>
      </header>

      {/* Inbox Layout */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#FBF7F6]">
        {/* Filtros rápidos */}
        <div className="p-4 flex flex-wrap items-center gap-4 border-b border-white bg-white/50 backdrop-blur-sm">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400" />
              <select className="text-[10px] font-semibold uppercase text-slate-600 outline-none bg-transparent" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                 <option value="all">Todos Profissionais</option>
                 {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <Flag className="w-3 h-3 text-slate-400" />
              <select className="text-[10px] font-semibold uppercase text-slate-600 outline-none bg-transparent" value={markerFilter} onChange={e => setMarkerFilter(e.target.value)}>
                 <option value="all">Todos Marcadores</option>
                 <option value="none">Sem Marcador</option>
                 <option value="importante">⚠️ Importante</option>
                 <option value="pendente">⏳ Pendente</option>
                 <option value="sucesso">✅ Sucesso</option>
              </select>
           </div>
        </div>

        {/* Lista Estilo Inbox */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {isLoading ? (
             <div className="space-y-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-50">
                     <Skeleton className="w-16 h-8 shrink-0" />
                     <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                     <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-2.5 w-1/4" />
                     </div>
                     <Skeleton className="w-20 h-8 shrink-0" />
                  </div>
                ))}
             </div>
           ) : filteredAppointments.length === 0 ? (
             <EmptyState
               icon={CalendarIcon}
               title="Nenhum agendamento nesta lista"
               description="Ajuste os filtros acima ou crie um novo agendamento para começar."
               actionLabel="Novo Agendamento"
               onAction={openNewModal}
               className="h-64"
             />
           ) : (
             filteredAppointments.map(appt => {
               const client = clients.find(c => c.id === appt.clientId);
               const staffMember = staff.find(s => s.id === appt.staffId);
               const dateObj = parseISO(appt.date);

               return (
                 <div
                   key={appt.id}
                   onClick={() => {
                     setEditingAppointment(appt);
                     setFormData({ ...appt, paymentMethod: appt.paymentMethod || '' } as any);
                     setIsModalOpen(true);
                   }}
                   className={cn(
                     "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white p-4 rounded-2xl border border-transparent shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden",
                     appt.status === 'completed' ? "opacity-70 grayscale-[0.3]" : appt.status === 'cancelled' ? "opacity-50" : "hover:border-pink-100"
                   )}
                 >
                   {/* Linha Lateral de Status */}
                   <div className={cn(
                     "absolute left-0 top-0 bottom-0 w-1",
                     appt.status === 'completed' ? "bg-emerald-500" : appt.status === 'cancelled' ? "bg-red-300" : "bg-[#E38EA0]"
                   )} />

                   <div className="flex items-center gap-4">
                      {/* Horário */}
                      <div className="w-16 sm:w-20 shrink-0 text-center flex flex-col items-center">
                        <span className="text-sm font-semibold text-slate-800 leading-none">{format(dateObj, 'HH:mm')}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{format(dateObj, 'dd/MM')}</span>
                      </div>

                      {/* Avatar/Ícone */}
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#E38EA0] border border-slate-50 font-semibold shrink-0">
                        {client?.name?.[0] || 'C'}
                      </div>

                      {/* Informações Principais — versão compacta, só em telas pequenas */}
                      <div className="flex-1 min-w-0 sm:hidden">
                         <h4 className="text-xs font-semibold text-slate-800 uppercase leading-none truncate">{client?.name || 'Cliente s/ nome'}</h4>
                         <p className="text-[10px] font-semibold text-[#E38EA0] truncate mt-1">{appt.service}</p>
                         {appt.notes && (
                           <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1" title={appt.notes}>
                             <FileText className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{appt.notes}</span>
                           </p>
                         )}
                      </div>
                   </div>

                   {/* Informações Principais — versão completa, a partir de sm */}
                   <div className="hidden sm:grid flex-1 grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="min-w-0">
                         <h4 className="text-xs font-semibold text-slate-800 uppercase leading-none truncate">{client?.name || 'Cliente s/ nome'}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cliente</p>
                         {appt.notes && (
                           <p className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1" title={appt.notes}>
                             <FileText className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{appt.notes}</span>
                           </p>
                         )}
                      </div>
                      <div>
                         <h4 className="text-xs font-semibold text-[#F5D3DA] border-b-2 border-pink-50 inline-block uppercase leading-none">{appt.service}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Procedimento</p>
                      </div>
                      <div>
                         <h4 className="text-xs font-bold text-slate-600 uppercase leading-none truncate flex items-center gap-1"><Scissors className="w-3 h-3" /> {staffMember?.name}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Profissional</p>
                      </div>
                   </div>

                   {/* Marcador */}
                   {appt.marker && (
                     <div className="hidden lg:flex items-center justify-center">
                        <span className={cn(
                          appt.marker === 'importante' ? 'badge-warning' : appt.marker === 'pendente' ? 'badge-neutral' : appt.marker === 'sucesso' ? 'badge-success' : 'badge-neutral'
                        )}>
                          {appt.marker === 'importante' ? 'Importante' : appt.marker === 'pendente' ? 'Pendente' : appt.marker === 'sucesso' ? 'Sucesso' : appt.marker}
                        </span>
                     </div>
                   )}

                   <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-3">
                      {/* Status/Valor */}
                      <div className="text-left sm:text-right sm:w-32 shrink-0">
                         <p className="text-sm font-semibold text-slate-800 font-mono italic leading-none mb-1.5">{formatCurrency(appt.price)}</p>
                         <span className={cn(
                           appt.status === 'completed' ? 'badge-success' : appt.status === 'cancelled' ? 'badge-error' : 'badge-primary'
                         )}>{appt.status === 'scheduled' ? 'Agendado' : appt.status === 'completed' ? 'Finalizado' : 'Cancelado'}</span>
                         {appt.status === 'completed' && appt.paymentMethod && (
                           <span className="block text-[8px] font-semibold text-slate-300 uppercase tracking-widest mt-1">
                             {PAYMENT_METHODS.find(pm => pm.value === appt.paymentMethod)?.label || appt.paymentMethod}
                           </span>
                         )}
                      </div>

                      {/* Ações — sempre visíveis no celular (sem hover), reveladas no hover a partir de sm */}
                      <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:scale-95 sm:origin-right shrink-0">
                         {isAdmin && appt.status === 'scheduled' && (
                           <>
                              <button onClick={(e) => { e.stopPropagation(); setPayingAppointmentId(appt.id); }} title="Concluir" className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg hover:bg-emerald-600 transition-all"><Check className="w-3 h-3" /></button>
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'cancelled'); }} title="Cancelar" className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-red-400 transition-all"><X className="w-3 h-3" /></button>
                           </>
                         )}
                         {appt.status === 'completed' && (
                           <button onClick={(e) => { e.stopPropagation(); setReceiptAppointmentId(appt.id); }} title="Nota de Serviço" className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-[#E38EA0] transition-all"><FileText className="w-3 h-3" /></button>
                         )}
                         {!isAdmin && <button className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-blue-400 transition-all" title="Ver Detalhes"><Eye className="w-3 h-3" /></button>}
                         {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteAppointment(appt.id); }} title="Excluir" className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-red-500 transition-all"><Trash2 className="w-3 h-3" /></button>}
                      </div>
                   </div>
                 </div>
               );
             })
           )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-fade-up border border-slate-100 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-start mb-7 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 tracking-tight leading-none">{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                  <p className="text-slate-400 text-xs font-medium mt-2">Preencha os dados do atendimento.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-6 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div>
                      <label className="label-premium">Cliente</label>
                      <SearchableSelect
                        options={sortedClients.map(c => ({ value: c.id, label: c.name }))}
                        value={formData.clientId}
                        onChange={(clientId) => setFormData({ ...formData, clientId })}
                        placeholder="Selecionar cliente"
                        searchPlaceholder="Buscar por nome..."
                        emptyMessage="Nenhum cliente encontrado."
                        disabled={!isAdmin && !!editingAppointment}
                      />
                   </div>
                   <div>
                      <label className="label-premium">Profissional</label>
                      <select
                         required
                         disabled={!isAdmin}
                         className="select-premium disabled:opacity-50"
                         value={formData.staffId}
                         onChange={e => setFormData({...formData, staffId: e.target.value})}
                      >
                         <option value="">Selecionar profissional</option>
                         {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div>
                      <label className="label-premium">Serviço</label>
                      <select
                        required
                        disabled={!isAdmin && !!editingAppointment}
                        className="select-premium disabled:opacity-70"
                        value={formData.service}
                        onChange={e => handleServiceChange(e.target.value)}
                      >
                         <option value="">Selecionar serviço</option>
                         {availableServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="label-premium">Data e hora</label>
                      <input
                        required
                        type="datetime-local"
                        disabled={!isAdmin && !!editingAppointment}
                        className="input-premium disabled:opacity-70"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                     <label className="label-premium">Status</label>
                     <select
                       required
                       disabled={!isAdmin}
                       className="select-premium disabled:opacity-50"
                       value={(formData as any).status || 'scheduled'}
                       onChange={e => setFormData({...formData, status: e.target.value} as any)}
                     >
                        <option value="scheduled">Agendado</option>
                        <option value="completed">Concluído</option>
                        <option value="cancelled">Cancelado</option>
                     </select>
                  </div>
                  <div>
                     <label className="label-premium">Valor (R$)</label>
                     <input
                        required
                        type="number"
                        className="input-premium font-mono disabled:opacity-50"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                        disabled={!isAdmin}
                     />
                  </div>
                </div>

                <div>
                  <label className="label-premium">Forma de pagamento</label>
                  <select
                    disabled={!isAdmin}
                    className="select-premium disabled:opacity-50"
                    value={formData.paymentMethod || ''}
                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                  >
                     <option value="">Não informado</option>
                     {PAYMENT_METHODS.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-premium">Marcador (comunicação)</label>
                  <select
                    className="select-premium"
                    value={formData.marker || ''}
                    onChange={e => setFormData({...formData, marker: e.target.value})}
                  >
                    <option value="">Nenhum marcador</option>
                    <option value="importante">Importante</option>
                    <option value="pendente">Pendente</option>
                    <option value="sucesso">Sucesso</option>
                  </select>
                </div>

                <div>
                   <label className="label-premium">Observações internas</label>
                   <textarea className="textarea-premium" placeholder="Adicione comentários ou notas sobre o atendimento..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>

                <div className="flex gap-3 pt-1">
                  {isAdmin && editingAppointment && (
                    <button
                      type="button"
                      onClick={() => deleteAppointment(editingAppointment.id)}
                      title="Excluir agendamento"
                      aria-label="Excluir agendamento"
                      className="px-5 rounded-xl border border-red-100 text-red-300 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button type="submit" className="flex-1 btn-primary h-12 rounded-xl text-sm font-semibold group flex items-center justify-center gap-2">
                    {editingAppointment ? 'Salvar alterações' : 'Confirmar agendamento'} <LucideArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONCLUIR ATENDIMENTO RÁPIDO: escolher forma de pagamento */}
      {payingAppointment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setPayingAppointmentId(null)}>
          <div className="bg-white rounded-5xl w-full max-w-sm p-8 shadow-2xl border border-pink-50 animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight mb-1">Concluir Atendimento</h3>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-6">
              {clients.find(c => c.id === payingAppointment.clientId)?.name || 'Cliente'} · {formatCurrency(payingAppointment.price)}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Como foi pago?</p>
            <div className="grid grid-cols-1 gap-3">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={async () => {
                    const finishedId = payingAppointment.id;
                    await updateStatus(finishedId, 'completed', pm.value);
                    setPayingAppointmentId(null);
                    setReceiptAppointmentId(finishedId);
                  }}
                  className="w-full py-4 rounded-2xl border border-pink-100 bg-[#FBF7F6] hover:bg-[#E38EA0] hover:text-white text-slate-700 font-semibold text-sm uppercase tracking-wide transition-all active:scale-95"
                >
                  {pm.label}
                </button>
              ))}
            </div>
            <button onClick={() => setPayingAppointmentId(null)} className="w-full mt-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
          </div>
        </div>
      )}

      {receiptAppointmentId && (() => {
        const receiptAppointment = appointments.find(a => a.id === receiptAppointmentId);
        if (!receiptAppointment) return null;
        return (
          <ServiceReceiptModal
            appointment={receiptAppointment}
            client={clients.find(c => c.id === receiptAppointment.clientId)}
            staffMember={staff.find(s => s.id === receiptAppointment.staffId)}
            onClose={() => setReceiptAppointmentId(null)}
          />
        );
      })()}
    </div>
  );
}
