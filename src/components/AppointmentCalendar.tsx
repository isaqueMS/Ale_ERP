import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, Scissors, ShoppingBag, Search, Bell, XCircle } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, Client, Staff, Service, Transaction, Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

export default function AppointmentCalendar() {
  const { user, profile, isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = React.useState<string>('all');
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  const [formData, setFormData] = React.useState({
    clientId: '',
    staffId: '',
    service: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    status: 'scheduled' as const,
    price: 0,
    notes: ''
  });

  const [productFormData, setProductFormData] = React.useState({
    productId: '',
    clientId: '',
    quantity: 1,
    date: format(new Date(), 'yyyy-MM-dd'),
    price: 0
  });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'appointments'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });
    onSnapshot(collection(db, 'clients'), (snap) => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))));
    onSnapshot(collection(db, 'staff'), (snap) => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff))));
    onSnapshot(collection(db, 'services'), (snap) => setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))));
    onSnapshot(collection(db, 'products'), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    onSnapshot(collection(db, 'transactions'), (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const aptDate = new Date(`${formData.date}T${formData.time}`);
      const staffMember = staff.find(s => s.id === formData.staffId);
      const commissionAmount = (formData.price * (staffMember?.commission || 0)) / 100;
      const data = { ...formData, commissionAmount, date: aptDate.toISOString(), updatedAt: new Date().toISOString() };
      
      let appointmentId = editingAppointment?.id;
      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'appointments'), { ...data, createdAt: new Date().toISOString() });
        appointmentId = docRef.id;
      }

      if (formData.status === 'completed' && !transactions.find(t => t.appointmentId === appointmentId)) {
        await addDoc(collection(db, 'transactions'), {
          type: 'income', category: 'Serviço', amount: formData.price, date: new Date().toISOString(),
          description: `Serviço: ${formData.service} (${clients.find(c => c.id === formData.clientId)?.name})`,
          clientId: formData.clientId, clientName: clients.find(c => c.id === formData.clientId)?.name || '',
          staffId: formData.staffId, staffName: staffMember?.name || '',
          appointmentId, createdAt: new Date().toISOString(), createdBy: user?.uid, creatorName: profile?.name || 'Atendente'
        });
      }
      setIsModalOpen(false);
      setEditingAppointment(null);
    } catch (error) { console.error(error); }
  };

  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i)), [currentDate]);
  
  const dailyAppointments = React.useMemo(() => {
    return appointments.filter(apt => isSameDay(parseISO(apt.date), currentDate)).sort((a, b) => a.date.localeCompare(b.date));
  }, [appointments, currentDate]);

  const next30Days = React.useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(new Date(), i - 2)), []);

  if (isMobile) {
    return (
      <div className="pb-24 pt-4 px-4 bg-background min-h-screen animate-in fade-in duration-500">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="industrial-header text-3xl">Agenda <span className="metallic-gold">Live</span></h1>
            <p className="text-[9px] font-black text-muted uppercase tracking-[0.3em] opacity-40">Operacional • {format(currentDate, 'MMMM yyyy', { locale: ptBR })}</p>
          </div>
          <div className="flex gap-2">
             <button className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center border border-white/5"><Bell className="w-5 h-5 text-muted" /></button>
             <button onClick={() => setIsModalOpen(true)} className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20"><Plus className="w-6 h-6 text-white" /></button>
          </div>
        </header>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-10">
          <div className="flex gap-4 min-w-max pb-4">
            {next30Days.map((day) => {
              const selected = isSameDay(day, currentDate);
              return (
                <button key={day.toString()} onClick={() => setCurrentDate(day)} 
                  className={cn("flex flex-col items-center justify-center w-16 h-24 rounded-[2rem] transition-all border", 
                  selected ? "bg-accent border-accent shadow-xl shadow-accent/20 scale-110 z-10" : "bg-secondary/20 border-white/5 text-muted")}>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", selected ? "text-white" : "text-muted")}>{format(day, 'eee', { locale: ptBR })}</span>
                  <span className={cn("text-xl font-black mt-2", selected ? "text-white" : "text-text")}>{format(day, 'dd')}</span>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-white mt-1 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
           {dailyAppointments.length === 0 ? (
             <div className="glass-card p-16 text-center border-dashed border-white/5">
                <Clock className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em]">Nenhum Comando Encontrado</p>
             </div>
           ) : (
             dailyAppointments.map((apt) => (
                <div key={apt.id} className="relative pl-12 group" onClick={() => { setEditingAppointment(apt); setIsModalOpen(true); }}>
                   <div className="absolute left-[18px] top-4 bottom-0 w-px bg-white/5" />
                   <div className={cn("absolute left-3 top-4 w-3 h-3 rounded-full border-2 border-background z-10", 
                     apt.status === 'completed' ? "bg-green-500" : apt.status === 'cancelled' ? "bg-red-500" : "bg-accent")} />
                   <div className="mobile-card flex-1 bg-secondary/30 relative active:bg-accent group-active:text-white transition-all">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <span className="text-[9px] font-black text-accent uppercase tracking-widest mb-1 block group-active:text-white">{format(parseISO(apt.date), 'HH:mm')}</span>
                            <h4 className="text-lg font-black text-text uppercase tracking-tighter group-active:text-white">{clients.find(c => c.id === apt.clientId)?.name}</h4>
                         </div>
                         <div className="text-right">
                            <p className="text-lg font-black text-accent tracking-tighter group-active:text-white">{formatCurrency(apt.price)}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-white/5 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-white/5 group-active:bg-white/20">{apt.service}</span>
                        <span className="text-[8px] font-black text-muted uppercase tracking-widest">{staff.find(s => s.id === apt.staffId)?.name}</span>
                      </div>
                   </div>
                </div>
             ))
           )}
        </div>
        {renderModals()}
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="industrial-header">Agenda <span className="metallic-gold">Mestra</span></h1>
          <p className="text-muted mt-3 font-black uppercase text-xs tracking-[0.4em] opacity-40">Industrial Control • Command Terminal</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-secondary/40 backdrop-blur-3xl p-2 rounded-2xl border border-white/5 flex items-center shadow-2xl">
              <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-3 hover:bg-white/5 rounded-xl transition-all"><ChevronLeft className="w-6 h-6 text-muted" /></button>
              <div className="px-8 font-black text-xs uppercase tracking-[0.3em] text-text border-x border-white/5">{format(weekDays[0], "dd MMM", { locale: ptBR })} - {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}</div>
              <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-3 hover:bg-white/5 rounded-xl transition-all"><ChevronRight className="w-6 h-6 text-muted" /></button>
           </div>
           <button onClick={() => setIsModalOpen(true)} className="btn-accent h-full flex items-center gap-3"><Plus className="w-6 h-6" /> Agendar</button>
        </div>
      </header>

      <div className="glass-card bg-secondary/10 border-white/5 overflow-hidden">
        <div className="grid grid-cols-8 border-b border-white/5">
          <div className="p-6 border-r border-white/5 bg-primary/20 flex items-center justify-center"><Clock className="w-5 h-5 text-accent" /></div>
          {weekDays.map((day) => (
            <div key={day.toString()} className={cn("p-8 text-center border-r border-white/5 last:border-r-0 transition-colors", isSameDay(day, new Date()) ? "bg-accent/5" : "")}>
              <p className="text-[10px] text-muted uppercase font-black tracking-[0.3em] mb-2">{format(day, 'eee', { locale: ptBR })}</p>
              <p className={cn("text-3xl font-black tracking-tighter leading-none", isSameDay(day, new Date()) ? "metallic-gold" : "text-text")}>{format(day, 'dd')}</p>
            </div>
          ))}
        </div>
        <div className="max-h-[700px] overflow-y-auto scrollbar-hide">
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-white/5 last:border-b-0 hover:bg-white/[0.01] transition-colors">
              <div className="p-6 border-r border-white/5 bg-primary/30 text-right text-xs font-black text-muted tracking-widest">{hour.toString().padStart(2, '0')}:00</div>
              {weekDays.map((day) => {
                const dayApps = appointments.filter(apt => {
                  const aptDate = parseISO(apt.date);
                  return isSameDay(aptDate, day) && aptDate.getHours() === hour && (isAdmin ? (selectedStaffFilter === 'all' || apt.staffId === selectedStaffFilter) : apt.staffId === staff.find(s => s.email === user?.email)?.id);
                });
                return (
                  <div key={day.toString()} className="p-2 border-r border-white/5 last:border-r-0 min-h-[120px] relative group cursor-pointer" onClick={() => { setEditingAppointment(null); setFormData({ ...formData, date: format(day, 'yyyy-MM-dd'), time: `${hour.toString().padStart(2, '0')}:00` }); setIsModalOpen(true); }}>
                    {dayApps.map((apt) => (
                      <button key={apt.id} onClick={(e) => { e.stopPropagation(); setEditingAppointment(apt); setIsModalOpen(true); }} 
                        className={cn("w-full p-4 rounded-2xl text-left shadow-2xl mb-2 transition-all hover:scale-[1.02] border backdrop-blur-xl", 
                        apt.status === 'scheduled' ? "bg-accent/10 border-accent/20 text-accent" : 
                        apt.status === 'completed' ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                        <p className="font-black text-[11px] uppercase tracking-tighter truncate">{clients.find(c => c.id === apt.clientId)?.name}</p>
                        <p className="text-[8px] font-black uppercase opacity-60 mt-1 truncate tracking-widest">{apt.service}</p>
                      </button>
                    ))}
                    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-primary/90 border border-white/10 rounded-[3rem] w-full max-w-xl p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative">
               <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-muted hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
               <h3 className="industrial-header text-3xl mb-8">Comando <span className="metallic-gold">Agendamento</span></h3>
               <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="col-span-2"><label className="block text-[10px] font-black uppercase text-muted tracking-[0.3em] mb-2 ml-2">Cliente Alvo</label>
                        <select required className="input-field" value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                     <div><label className="block text-[10px] font-black uppercase text-muted tracking-[0.3em] mb-2 ml-2">Especialista</label>
                        <select required className="input-field" value={formData.staffId} onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}><option value="">Selecione</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                     <div><label className="block text-[10px] font-black uppercase text-muted tracking-[0.3em] mb-2 ml-2">Procedimento</label>
                        <select required className="input-field" onChange={(e) => { const s = services.find(serv => serv.id === e.target.value); if (s) setFormData({ ...formData, service: s.name, price: s.price }); }}><option value="">Selecione</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                     <div className="col-span-2"><label className="block text-[10px] font-black uppercase text-muted tracking-[0.3em] mb-2 ml-2">Preço de Operação</label>
                        <input required type="number" className="input-field" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} /></div>
                  </div>
                  <div className="flex gap-4 pt-6">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Abortar</button>
                     <button type="submit" className="btn-accent flex-1">Confirmar Operação</button>
                  </div>
               </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
