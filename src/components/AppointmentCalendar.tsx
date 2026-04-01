import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, User, Scissors, CheckCircle, XCircle, AlertCircle, ShoppingBag, Search, Package } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, Client, Staff, Service, Transaction, Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import {
  format,
  startOfWeek,
  addDays,
  startOfDay,
  isSameDay,
  addWeeks,
  subWeeks,
  parseISO,
  isEqual,
  startOfHour,
  addHours,
  isWithinInterval,
  endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

export default function AppointmentCalendar() {
  const { user, profile, isAdmin, isAgente } = useAuth();
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

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    const q = query(collection(db, 'appointments'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });

    onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    onSnapshot(collection(db, 'transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const aptDate = new Date(`${formData.date}T${formData.time}`);
      const staffMember = staff.find(s => s.id === formData.staffId);
      const commissionPercent = staffMember?.commission || 0;
      const commissionAmount = (formData.price * commissionPercent) / 100;

      const data = {
        ...formData,
        commissionAmount,
        date: aptDate.toISOString(),
        updatedAt: new Date().toISOString()
      };

      let appointmentId = editingAppointment?.id;

      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'appointments'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        appointmentId = docRef.id;
      }

      // If status is completed, create a transaction if it doesn't exist
      if (formData.status === 'completed') {
        const existingTx = transactions.find(t => t.appointmentId === appointmentId);
        if (!existingTx) {
          const client = clients.find(c => c.id === formData.clientId);
          const staffMemberTx = staff.find(s => s.id === formData.staffId);
          await addDoc(collection(db, 'transactions'), {
            type: 'income',
            category: 'Serviço',
            amount: formData.price,
            date: new Date().toISOString(),
            description: `Serviço: ${formData.service} (${client?.name || 'Cliente'})`,
            clientId: formData.clientId,
            clientName: client?.name || '',
            staffId: formData.staffId,
            staffName: staffMemberTx?.name || '',
            appointmentId: appointmentId,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || 'unknown',
            creatorName: profile?.name || user?.email?.split('@')[0] || 'Atendente'
          });
        }
      }

      setIsModalOpen(false);
      setEditingAppointment(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Erro ao salvar agendamento.');
    }
  };

  const handleProductSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const product = products.find(p => p.id === productFormData.productId);
      const client = clients.find(c => c.id === productFormData.clientId);
      if (!product || !client) return;

      const saleDate = new Date(`${productFormData.date}T12:00:00`);

      await addDoc(collection(db, 'transactions'), {
        type: 'income',
        category: 'Produto',
        amount: productFormData.price * productFormData.quantity,
        date: saleDate.toISOString(),
        description: `Venda: ${product.name} (x${productFormData.quantity})`,
        clientId: productFormData.clientId,
        clientName: client.name,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        creatorName: profile?.name || user?.email?.split('@')[0] || 'Atendente'
      });

      await updateDoc(doc(db, 'products', product.id), {
        stock: Math.max(0, Number(product.stock || 0) - Number(productFormData.quantity || 1))
      });

      setIsProductModalOpen(false);
      alert('Venda registrada!');
    } catch (error) {
      console.error('Error saving sale:', error);
    }
  };

  const handleFinalizeAndCharge = async (apt: Appointment) => {
    const client = clients.find(c => c.id === apt.clientId);
    if (!client || !window.confirm('Confirmar cobrança?')) return;

    try {
      const staffMember = staff.find(s => s.id === apt.staffId);
      const commissionPercent = staffMember?.commission || 0;
      const commissionAmount = (apt.price * commissionPercent) / 100;

      await updateDoc(doc(db, 'appointments', apt.id), { 
        status: 'completed',
        commissionAmount
      });
      await addDoc(collection(db, 'transactions'), {
        type: 'income',
        category: 'Serviço',
        amount: apt.price,
        date: new Date().toISOString(),
        description: `Serviço: ${apt.service} (${client.name})`,
        clientId: apt.clientId,
        clientName: client.name,
        staffId: apt.staffId,
        staffName: staffMember?.name || '',
        appointmentId: apt.id,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        creatorName: profile?.name || user?.email?.split('@')[0] || 'Atendente'
      });
      setIsModalOpen(false);
      alert('Cobrado!');
    } catch (error) {
      console.error('Error finalizing:', error);
    }
  };

  const weekDays = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i));
  }, [currentDate]);

  const dailyAppointments = React.useMemo(() => {
    return appointments
      .filter(apt => isSameDay(parseISO(apt.date), currentDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [appointments, currentDate]);

  const next30Days = React.useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => addDays(new Date(), i - 2));
  }, []);

  const handleEdit = (apt: Appointment) => {
    setEditingAppointment(apt);
    const dateObj = parseISO(apt.date);
    setFormData({
      clientId: apt.clientId,
      staffId: apt.staffId,
      service: apt.service,
      date: format(dateObj, 'yyyy-MM-dd'),
      time: format(dateObj, 'HH:mm'),
      status: apt.status,
      price: apt.price,
      notes: apt.notes || ''
    });
    setIsModalOpen(true);
  };

  if (isMobile) {
    return (
      <div className="pb-24 pt-4 px-4 bg-[#F9F9F9] min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter text-text uppercase">Studio Ale</h1>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">{isAdmin ? 'Minha Agenda' : 'Meus Serviços'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white shadow-premium flex items-center justify-center border border-secondary/20"><Search className="w-5 h-5 text-muted" /></button>
            <div className="w-10 h-10 rounded-full bg-accent text-white shadow-lg flex items-center justify-center"><Scissors className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-8">
          <div className="flex gap-4 min-w-max pb-3">
            {next30Days.map((day) => {
              const selected = isSameDay(day, currentDate);
              return (
                <button key={day.toString()} onClick={() => setCurrentDate(day)} className={cn("flex flex-col items-center justify-center w-14 h-20 rounded-3xl transition-all", selected ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-white text-muted shadow-premium border border-secondary/10")}>
                  <span className="text-[10px] font-black uppercase">{format(day, 'eee', { locale: ptBR })}</span>
                  <span className="text-lg font-black mt-1">{format(day, 'dd')}</span>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 relative">
          {dailyAppointments.length === 0 ? (
            <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center"><Clock className="w-8 h-8 text-primary/50" /></div>
            <p className="text-sm font-bold text-muted">Sem clientes para hoje.</p>
            <button onClick={() => setIsModalOpen(true)} className="text-xs font-black uppercase text-primary tracking-widest">+ Agendar</button>
            </div>
          ) : (
            dailyAppointments.map((apt, index) => {
              const client = clients.find(c => c.id === apt.clientId);
              const staffMember = staff.find(s => s.id === apt.staffId);
              return (
                <div key={apt.id} className="relative pl-10">
                  {index < dailyAppointments.length - 1 && <div className="timeline-line" />}
                  <div className={cn("timeline-dot shadow-lg", apt.status === 'completed' ? "bg-green-400" : apt.status === 'cancelled' ? "bg-red-400" : "bg-primary")} />
                  <div className="flex gap-4 items-start">
                    <span className="text-xs font-black text-muted w-10 shrink-0 mt-1">{format(parseISO(apt.date), 'HH:mm')}</span>
                    <button onClick={() => handleEdit(apt)} className="mobile-card flex-1 text-left relative overflow-hidden">
                      <div className="flex flex-col gap-0.5">
                        <h4 className="font-black text-lg text-text leading-tight">{client?.name || 'Cliente'}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">{apt.service}</span>
                          <span className="text-[10px] font-bold text-muted uppercase italic">com {staffMember?.name?.split(' ')[0]}</span>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <span className="text-sm font-black text-accent">{formatCurrency(apt.price)}</span>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase border",
                            apt.status === 'scheduled' ? "border-primary/20 text-primary bg-primary/5" : 
                            apt.status === 'completed' ? "border-green-200 text-green-600 bg-green-50" :
                            "border-red-200 text-red-600 bg-red-50"
                          )}>
                            {apt.status === 'scheduled' ? 'Agendado' : apt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 items-end z-40">
          {isAdmin && (
            <button onClick={() => setIsProductModalOpen(true)} className="w-14 h-14 rounded-full bg-accent text-white shadow-lg flex items-center justify-center hover:bg-accent/90 transition-all">
              <ShoppingBag className="w-6 h-6" />
            </button>
          )}
          <button onClick={() => { setFormData({ ...formData, date: format(currentDate, 'yyyy-MM-dd') }); setIsModalOpen(true); }} className="fab-button"><Plus className="w-8 h-8" /></button>
        </div>
        {renderModals()}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div className="flex items-center bg-white rounded-xl border border-secondary shadow-sm overflow-hidden">
          <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-secondary/20 transition-colors"><ChevronLeft className="w-5 h-5 text-muted" /></button>
          <div className="px-4 py-2 font-black text-xs uppercase tracking-widest text-text border-x border-secondary">
            {format(weekDays[0], "dd MMM", { locale: ptBR })} - {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
          </div>
          <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-secondary/20 transition-colors"><ChevronRight className="w-5 h-5 text-muted" /></button>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <button onClick={() => setIsProductModalOpen(true)} className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-2xl font-bold text-xs shadow-lg flex items-center gap-2 uppercase tracking-widest"><ShoppingBag className="w-5 h-5" />Vender Produto</button>}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <select value={selectedStaffFilter} onChange={(e) => setSelectedStaffFilter(e.target.value)} className="bg-secondary/10 border-none text-[10px] font-black uppercase rounded-2xl focus:ring-1 focus:ring-primary cursor-pointer py-2.5 px-4"><option value="all">TODOS ATENDENTES</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}</select>
            )}
            <button onClick={() => { setFormData({ ...formData, date: format(currentDate, 'yyyy-MM-dd') }); setIsModalOpen(true); }} className="btn-primary py-2.5 px-6 shadow-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest"><Plus className="w-5 h-5" />Agendar</button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide pb-4">
          <div className="min-w-[950px]">
            <div className="grid grid-cols-8 border-b border-secondary bg-white">
              <div className="p-4 border-r border-secondary bg-secondary/5 flex items-center justify-center"><Clock className="w-4 h-4 text-muted" /></div>
              {weekDays.map((day) => (
                <div key={day.toString()} className={cn("p-4 text-center border-r border-secondary last:border-r-0", isSameDay(day, new Date()) ? "bg-primary/5" : "")}>
                  <p className="text-[10px] text-muted uppercase font-black tracking-widest">{format(day, 'eee', { locale: ptBR })}</p>
                  <p className={cn("text-xl font-black mt-1", isSameDay(day, new Date()) ? "text-primary" : "text-text")}>{format(day, 'dd')}</p>
                </div>
              ))}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-secondary/50 last:border-b-0">
                  <div className="p-4 border-r border-secondary bg-secondary/5 text-right text-xs font-black text-muted">{hour.toString().padStart(2, '0')}:00</div>
                  {weekDays.map((day) => {
                    const currentStaff = staff.find(s => s.email === user?.email);
                    const dayAppointments = appointments.filter(apt => {
                      const aptDate = new Date(apt.date);
                      return isSameDay(aptDate, day) && aptDate.getHours() === hour && (isAdmin ? (selectedStaffFilter === 'all' || apt.staffId === selectedStaffFilter) : apt.staffId === currentStaff?.id);
                    });
                    return (
                      <div key={day.toString()} className={cn("p-2 border-r border-secondary/50 last:border-r-0 min-h-[100px] relative transition-colors cursor-pointer hover:bg-primary/5", isSameDay(day, new Date()) ? "bg-primary/5" : "bg-white")} onClick={() => { setEditingAppointment(null); setFormData({ ...formData, date: format(day, 'yyyy-MM-dd'), time: `${hour.toString().padStart(2, '0')}:00` }); setIsModalOpen(true); }}>
                        {dayAppointments.map((apt) => (
                          <button key={apt.id} onClick={(e) => { e.stopPropagation(); handleEdit(apt); }} className={cn(
                            "w-full p-2 rounded-xl text-left text-xs mb-1 shadow-sm transition-all", 
                            apt.status === 'scheduled' ? "bg-primary/10 text-primary border border-primary/20" : 
                            apt.status === 'completed' ? "bg-green-100 text-green-700 border border-green-200" :
                            "bg-red-100 text-red-700 border border-red-200"
                          )}>
                            <p className="font-bold truncate">{clients.find(c => c.id === apt.clientId)?.name || 'Cliente'}</p>
                            <p className="opacity-80 truncate text-[9px]">{apt.service}</p>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <>
        {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative">
              <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-secondary/20 rounded-full transition-colors"><XCircle className="w-6 h-6 text-muted" /></button>
              <h3 className="text-2xl font-black tracking-tighter mb-6">Vender Produto</h3>
              <form onSubmit={handleProductSale} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Produto</label>
                    <select required className="input-field" value={productFormData.productId} onChange={(e) => { const p = products.find(prod => prod.id === e.target.value); if (p) setProductFormData({ ...productFormData, productId: e.target.value, price: p.salePrice || 0 }); }}><option value="">Selecione produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock || 0})</option>)}</select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Cliente</label>
                    <select required className="input-field" value={productFormData.clientId} onChange={(e) => setProductFormData({ ...productFormData, clientId: e.target.value })}><option value="">Selecione cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Quantidade</label>
                    <input required type="number" min="1" className="input-field" value={productFormData.quantity} onChange={(e) => setProductFormData({ ...productFormData, quantity: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Valor Unitário</label>
                    <input required type="number" className="input-field" value={productFormData.price} readOnly={isAgente} onChange={(e) => setProductFormData({ ...productFormData, price: Number(e.target.value) })} />
                    {isAgente && <p className="text-[9px] text-muted mt-1 italic">Preço definido pelo administrador</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="btn-secondary text-xs uppercase font-black">Cancelar</button>
                  <button type="submit" className="btn-accent text-xs uppercase font-black">Registrar Venda</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-secondary/20 rounded-full transition-colors"><XCircle className="w-6 h-6 text-muted" /></button>
              <h3 className="text-2xl font-black tracking-tighter mb-6">{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Cliente</label>
                    <select required className="input-field" value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}><option value="">Selecione cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Atendente</label>
                    <select required className="input-field" value={formData.staffId} onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}><option value="">Selecione atendente</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Serviço</label>
                    <select required className="input-field" onChange={(e) => { const s = services.find(serv => serv.id === e.target.value); if (s) setFormData({ ...formData, service: s.name, price: s.price }); }}><option value="">Selecione serviço</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Valor</label>
                    <input required type="number" className="input-field" value={formData.price} readOnly={isAgente} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                    {isAgente && <p className="text-[9px] text-muted mt-1 italic">Preço definido pelo administrador</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Status</label>
                    <select className="input-field" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                      <option value="scheduled">Agendado</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs uppercase font-black">Sair</button>
                  {editingAppointment && editingAppointment.status !== 'completed' && <button type="button" onClick={() => handleFinalizeAndCharge(editingAppointment)} className="btn-accent border-none text-xs uppercase font-black">Cobrar</button>}
                  <button type="submit" className="btn-primary text-xs uppercase font-black">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
