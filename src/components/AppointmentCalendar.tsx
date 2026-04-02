import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, User, Scissors, 
  Plus, ChevronLeft, ChevronRight, Check, X,
  Search, Filter, MoreVertical, Edit2, Trash2,
  ArrowRight as LucideArrowRight, Mail, Flag, Eye
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

  const [formData, setFormData] = useState({
    clientId: '',
    staffId: '',
    service: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: '',
    price: 0,
    marker: '',
    status: 'scheduled'
  });

  useEffect(() => {
    const unsubA = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
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
      status: 'scheduled'
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

      const data = {
        ...formData,
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
      createdAt: new Date().toISOString()
    });
  };

  const updateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    try {
      const appt = appointments.find(a => a.id === id);
      if (!appt) return;
      if (!isAdmin) return; // Só admin move status
      if (status === 'completed' && appt.status !== 'completed') {
        await createTransactionForAppointment(id, appt);
      }
      await updateDoc(doc(db, 'appointments', id), { status });
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
  });

  const handleServiceChange = (serviceName: string) => {
    const selectedService = services.find(s => s.name === serviceName);
    setFormData(prev => ({
      ...prev,
      service: serviceName,
      price: selectedService?.price || 0
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-up">
      {/* Header Inbox-style */}
      <header className="bg-white border-b border-slate-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
           <Mail className="w-8 h-8 text-[#FFB6C1]" />
           <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Caixa de Agendamentos</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{filteredAppointments.length} atendimentos encontrados</p>
           </div>
        </div>

        <div className="flex-1 max-w-2xl px-4">
          <div className="relative group">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#FFB6C1] transition-colors" />
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
      <div className="flex-1 overflow-hidden flex flex-col bg-[#F9FAFB]">
        {/* Filtros rápidos */}
        <div className="p-4 flex flex-wrap items-center gap-4 border-b border-white bg-white/50 backdrop-blur-sm">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400" />
              <select className="text-[10px] font-black uppercase text-slate-600 outline-none bg-transparent" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                 <option value="all">Todos Profissionais</option>
                 {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
           </div>
           
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <Flag className="w-3 h-3 text-slate-400" />
              <select className="text-[10px] font-black uppercase text-slate-600 outline-none bg-transparent" value={markerFilter} onChange={e => setMarkerFilter(e.target.value)}>
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
           {filteredAppointments.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                <Mail className="w-16 h-16 opacity-10 mb-4" />
                <p className="font-black uppercase tracking-widest text-xs opacity-40">Nenhum agendamento nesta lista</p>
             </div>
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
                     setFormData({ ...appt });
                     setIsModalOpen(true);
                   }}
                   className={cn(
                     "flex items-center gap-4 bg-white p-4 rounded-2xl border border-transparent shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden",
                     appt.status === 'completed' ? "opacity-70 grayscale-[0.3]" : appt.status === 'cancelled' ? "opacity-50" : "hover:border-pink-100"
                   )}
                 >
                   {/* Linha Lateral de Status */}
                   <div className={cn(
                     "absolute left-0 top-0 bottom-0 w-1",
                     appt.status === 'completed' ? "bg-emerald-500" : appt.status === 'cancelled' ? "bg-red-300" : "bg-[#FFB6C1]"
                   )} />

                   {/* Horário */}
                   <div className="w-20 text-center flex flex-col items-center">
                     <span className="text-sm font-black text-slate-800 leading-none">{format(dateObj, 'HH:mm')}</span>
                     <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{format(dateObj, 'dd/MM')}</span>
                   </div>

                   {/* Avatar/Ícone */}
                   <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#FFB6C1] border border-slate-50 font-black">
                     {client?.name?.[0] || 'C'}
                   </div>

                   {/* Informações Principais */}
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                         <h4 className="text-xs font-black text-slate-800 uppercase leading-none truncate">{client?.name || 'Cliente s/ nome'}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cliente</p>
                      </div>
                      <div>
                         <h4 className="text-xs font-black text-[#FFDAE0] border-b-2 border-pink-50 inline-block uppercase leading-none">{appt.service}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Procedimento</p>
                      </div>
                      <div>
                         <h4 className="text-xs font-bold text-slate-600 uppercase leading-none truncate flex items-center gap-1"><Scissors className="w-3 h-3" /> {staffMember?.name}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Profissional</p>
                      </div>
                   </div>

                   {/* Marcador */}
                   {appt.marker && (
                     <div className="hidden lg:flex px-3 py-1 bg-slate-50 rounded-full border border-slate-100 items-center justify-center">
                        <span className="text-[9px] font-black uppercase text-slate-600">
                          {appt.marker === 'importante' ? '⚠️ Importante' : appt.marker === 'pendente' ? '⏳ Pendente' : appt.marker === 'sucesso' ? '✅ Sucesso' : appt.marker}
                        </span>
                     </div>
                   )}

                   {/* Status/Valor */}
                   <div className="w-32 text-right">
                      <p className="text-sm font-black text-slate-800 font-mono italic leading-none">{formatCurrency(appt.price)}</p>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest mt-1 inline-block",
                        appt.status === 'completed' ? "text-emerald-500" : appt.status === 'cancelled' ? "text-red-400" : "text-[#FFB6C1]"
                      )}>{appt.status === 'scheduled' ? 'Agendado' : appt.status === 'completed' ? 'Finalizado' : 'Cancelado'}</span>
                   </div>

                   {/* Hover Actions */}
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 origin-right">
                      {isAdmin && appt.status === 'scheduled' && (
                        <>
                           <button onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'completed'); }} title="Concluir" className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg hover:bg-emerald-600 transition-all"><Check className="w-3 h-3" /></button>
                           <button onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'cancelled'); }} title="Cancelar" className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-red-400 transition-all"><X className="w-3 h-3" /></button>
                        </>
                      )}
                      {!isAdmin && <button className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-blue-400 transition-all" title="Ver Detalhes"><Eye className="w-3 h-3" /></button>}
                      {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteAppointment(appt.id); }} title="Excluir" className="p-2 bg-white text-slate-300 border border-slate-100 rounded-lg hover:text-red-500 transition-all"><Trash2 className="w-3 h-3" /></button>}
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
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingAppointment ? 'Editar' : 'Nova'} Reserva</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Detalhes do atendimento studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Cliente</label>
                      <select 
                        required 
                        disabled={!isAdmin && !!editingAppointment}
                        className="select-premium !py-2.5 !px-5 disabled:opacity-70" 
                        value={formData.clientId} 
                        onChange={e => setFormData({...formData, clientId: e.target.value})}
                      >
                         <option value="">Selecionar Cliente</option>
                         {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Profissional</label>
                      <select 
                         required 
                         disabled={!isAdmin}
                         className="select-premium !py-2.5 !px-5 disabled:opacity-50" 
                         value={formData.staffId} 
                         onChange={e => setFormData({...formData, staffId: e.target.value})}
                      >
                         <option value="">Selecionar Profissional</option>
                         {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Serviço</label>
                      <select 
                        required 
                        disabled={!isAdmin && !!editingAppointment}
                        className="select-premium !py-2.5 !px-5 disabled:opacity-70" 
                        value={formData.service} 
                        onChange={e => handleServiceChange(e.target.value)}
                      >
                         <option value="">Selecionar Serviço</option>
                         {availableServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                   </div>
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Data e Hora</label>
                      <input 
                        required 
                        type="datetime-local" 
                        disabled={!isAdmin && !!editingAppointment}
                        className="input-premium !py-2.5 !px-5 font-black uppercase text-[10px] disabled:opacity-70" 
                        value={formData.date} 
                        onChange={e => setFormData({...formData, date: e.target.value})} 
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                     <label className="floating-label">Status</label>
                     <select 
                       required 
                       disabled={!isAdmin && editingAppointment?.status === 'completed'}
                       className="select-premium !py-2.5 !px-5 disabled:opacity-50" 
                       value={(formData as any).status || 'scheduled'} 
                       onChange={e => setFormData({...formData, status: e.target.value} as any)}
                     >
                        <option value="scheduled">Agendado</option>
                        <option value="completed">Concluído</option>
                        <option value="cancelled">Cancelado</option>
                     </select>
                  </div>
                  <div className="relative pt-1.5 font-sans">
                     <label className="floating-label">Valor (R$)</label>
                     <input 
                        required 
                        type="number" 
                        className="input-premium font-mono !py-2.5 !px-5 shadow-sm disabled:opacity-50" 
                        value={formData.price} 
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                        disabled={!isAdmin}
                     />
                  </div>
                </div>

                <div className="relative pt-1.5 font-sans">
                  <label className="label-premium !text-[9px] !mb-1.5 uppercase font-black tracking-widest opacity-60">Marcador (Comunicação)</label>
                  <select 
                    className="select-premium !py-2.5 !px-5" 
                    value={formData.marker || ''} 
                    onChange={e => setFormData({...formData, marker: e.target.value})}
                  >
                    <option value="">Nenhum Marcador</option>
                    <option value="importante">⚠️ Importante</option>
                    <option value="pendente">⏳ Pendente</option>
                    <option value="sucesso">✅ Sucesso</option>
                  </select>
                </div>
  
                <div className="relative pt-1.5 font-sans mb-4">
                   <label className="label-premium !text-[9px] !mb-1.5 uppercase font-black tracking-widest opacity-60">Observações Internas / Comentários</label>
                   <textarea className="textarea-premium h-24 shadow-inner" placeholder="Adicione comentários ou notas sobre o atendimento..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>

                <div className="flex gap-4">
                  {isAdmin && editingAppointment && (
                    <button 
                      type="button" 
                      onClick={() => deleteAppointment(editingAppointment.id)} 
                      className="px-6 rounded-2xl border-2 border-red-50 text-red-300 hover:border-red-100 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button type="submit" className="flex-1 btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    {editingAppointment ? 'Aplicar Alterações' : 'Confirmar Agenda'} <LucideArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
