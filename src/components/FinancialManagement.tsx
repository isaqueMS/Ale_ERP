import React from 'react';
import { 
  Plus, Search, ArrowUpCircle, ArrowDownCircle, DollarSign, PieChart, 
  TrendingUp, TrendingDown, Filter, Trash2, Edit2, X, CheckCircle, 
  MessageSquare, Check, Edit3, Clock, Calendar, BarChart2, AlertCircle 
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Appointment, Staff } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, eachMonthOfInterval, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

export default function FinancialManagement() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'income' | 'expense' | 'commissions'>('all');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [formData, setFormData] = React.useState({
    type: 'income' as const,
    category: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });
  const [selectedStaff, setSelectedStaff] = React.useState('all');
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [noteValue, setNoteValue] = React.useState('');
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [commStartDate, setCommStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [commEndDate, setCommEndDate] = React.useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  const COLORS = ['#FFB7C5', '#F5E6D3', '#D4AF37', '#E6E6FA', '#F0FFF0', '#FFF0F5'];

  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    // Buscar TODAS as transações e filtrar no frontend para evitar problemas de índice
    const unsubscribe = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    });

    // Buscar TODOS os appointments para calcular comissões
    const unsubscribeAppointments = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(data);
    });

    const unsubscribeStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      setStaff(data);
    });

    return () => {
      unsubscribe();
      unsubscribeAppointments();
      unsubscribeStaff();
    };
  }, []);

  const totals = React.useMemo(() => {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;

    const filtered = transactions.filter(t => t.date >= start && t.date <= end);
    const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return { income, expense, balance: income - expense };
  }, [transactions, startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        creatorName: profile?.name || 'Administrador'
      };

      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
      } else {
        await addDoc(collection(db, 'transactions'), { ...data, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
      setEditingTransaction(null);
      setFormData({ type: 'income', category: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), description: '' });
    } catch (error) { console.error(error); }
  };

  const filteredTransactions = React.useMemo(() => {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;

    const filtered = transactions.filter(t => {
      // Comparação de data robusta (ajusta se a data for apenas YYYY-MM-DD ou ISO)
      const tDate = t.date?.includes('T') ? t.date : `${t.date}T00:00:00.000Z`;
      const inDateRange = tDate >= start && tDate <= end;

      const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || t.type === filterType;
      
      let matchesStaff = true;
      if (selectedStaff !== 'all') {
        const tx = t as any;
        matchesStaff = 
          tx.staffId === selectedStaff || 
          tx.createdBy === selectedStaff || 
          (tx.creatorName || '').toLowerCase().includes(selectedStaff.toLowerCase()) ||
          (tx.staffName || '').toLowerCase().includes(selectedStaff.toLowerCase());
      }
      
      return inDateRange && matchesSearch && matchesType && matchesStaff;
    });

    console.log('[FINANCEIRO] Total:', transactions.length, '| Filtrados:', filtered.length, '| Periodo:', startDate, 'a', endDate, '| Staff:', selectedStaff);
    return filtered;
  }, [transactions, startDate, endDate, searchTerm, filterType, selectedStaff]);

  const staffCommissions = React.useMemo(() => {
    const commissions: { [key: string]: { name: string; total: number; revenue: number; count: number; percent: number } } = {};
    staff.forEach(s => { commissions[s.id] = { name: s.name, total: 0, revenue: 0, count: 0, percent: s.commission || 0 }; });
    
    const start = `${commStartDate}T00:00:00.000Z`;
    const end = `${commEndDate}T23:59:59.999Z`;

    // Calcular comissões por APPOINTMENTS completados
    appointments
      .filter(a => a.status === 'completed' && a.date >= start && a.date <= end)
      .forEach(a => {
        if (commissions[a.staffId]) {
          const staffMember = staff.find(s => s.id === a.staffId);
          const commissionPercent = staffMember?.commission || 0;
          const price = Number(a.price) || 0;
          const calcCommission = price * (commissionPercent / 100);
          const commissionAmt = a.commissionAmount && a.commissionAmount > 0 
            ? a.commissionAmount 
            : calcCommission;
          
          commissions[a.staffId].revenue += price;
          commissions[a.staffId].total += commissionAmt;
          commissions[a.staffId].count += 1;
        }
      });

    // Se não encontrou nada via appointments, tentar via transactions
    const hasAnyFromApts = Object.values(commissions).some(c => c.count > 0);
    if (!hasAnyFromApts) {
      transactions
        .filter(t => t.type === 'income' && t.date >= start && t.date <= end)
        .forEach(t => {
          const tx = t as any;
          let matchedStaffId: string | null = null;
          
          if (tx.staffId && commissions[tx.staffId]) {
            matchedStaffId = tx.staffId;
          } else if (tx.appointmentId) {
            const apt = appointments.find(a => a.id === tx.appointmentId);
            if (apt && commissions[apt.staffId]) {
              matchedStaffId = apt.staffId;
            }
          }
          
          if (!matchedStaffId) {
            const staffByUid = staff.find(s => (s as any).uid === tx.createdBy);
            if (staffByUid) matchedStaffId = staffByUid.id;
          }
          
          if (matchedStaffId && commissions[matchedStaffId]) {
            const price = Number(t.amount) || 0;
            const commissionPercent = commissions[matchedStaffId].percent;
            const commissionAmt = price * (commissionPercent / 100);
            
            commissions[matchedStaffId].revenue += price;
            commissions[matchedStaffId].total += commissionAmt;
            commissions[matchedStaffId].count += 1;
          }
        });
    }

    return Object.entries(commissions).map(([id, data]) => ({ id, ...data }));
  }, [staff, appointments, transactions, commStartDate, commEndDate]);

  if (!isAdmin) return <div className="p-20 text-center font-black uppercase text-muted tracking-widest">Acesso Restrito Admin</div>;

  return (
    <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen lg:px-8">
      <header className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black text-text tracking-tighter uppercase">Gestão Financeira</h2>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">Controle de faturamento e lucro</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full lg:w-auto py-4 px-8 flex items-center justify-center gap-2 shadow-premium">
           <Plus className="w-5 h-5" /> Nova Transação
        </button>
      </header>

      {/* Totals Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <FinancialCard title="Receitas" value={totals.income} icon={TrendingUp} color="bg-green-500" trend="+8%" />
         <FinancialCard title="Despesas" value={totals.expense} icon={TrendingDown} color="bg-red-500" trend="-2%" />
         <FinancialCard title="Saldo Final" value={totals.balance} icon={DollarSign} color="bg-accent" />
      </div>

      {/* Filter Area - PREMIUM ERP STYLE */}
      <div className="glass-card p-6 bg-white border border-secondary shadow-premium space-y-6">
         <div className="flex items-center gap-3 border-b border-secondary/10 pb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Filtros de Busca Avançada</h3>
         </div>
         
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Search Bar */}
            <div className="lg:col-span-2 relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
               <input 
                  type="text" 
                  placeholder="Buscar por descrição ou categoria..." 
                  className="w-full bg-secondary/5 border-2 border-transparent focus:border-primary/20 rounded-2xl pl-12 pr-4 py-4 text-xs font-black text-text placeholder:text-muted/50 transition-all focus:ring-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
               <div className="relative">
                  <span className="absolute -top-2 left-3 bg-white px-2 text-[7px] font-black text-muted uppercase tracking-widest z-10">Início</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-secondary/5 border-none rounded-2xl p-4 text-[10px] font-black uppercase focus:ring-1 focus:ring-primary/20" />
               </div>
               <div className="relative">
                  <span className="absolute -top-2 left-3 bg-white px-2 text-[7px] font-black text-muted uppercase tracking-widest z-10">Fim</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-secondary/5 border-none rounded-2xl p-4 text-[10px] font-black uppercase focus:ring-1 focus:ring-primary/20" />
               </div>
            </div>

            {/* Staff Filter */}
            <div className="relative group">
               <span className="absolute -top-2 left-3 bg-white px-2 text-[7px] font-black text-muted uppercase tracking-widest z-10">Atendente</span>
               <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="w-full bg-secondary/5 border-none rounded-2xl p-4 text-[10px] font-black uppercase focus:ring-1 focus:ring-primary/20 appearance-none">
                  <option value="all">TODOS ATENDENTES</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* List / Cards for Transactions */}
      <div className="space-y-4">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Últimas Movimentações</h3>
            <div className="flex gap-2">
               <button onClick={() => setFilterType('all')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'all' ? "bg-primary text-white" : "bg-secondary/20 text-muted")}>Tudo</button>
               <button onClick={() => setFilterType('income')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'income' ? "bg-green-500 text-white" : "bg-secondary/20 text-muted")}>Rec.</button>
               <button onClick={() => setFilterType('expense')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'expense' ? "bg-red-500 text-white" : "bg-secondary/20 text-muted")}>Desp.</button>
            </div>
         </div>

         {filteredTransactions.map(t => (
           <div key={t.id} className="mobile-card p-4 bg-white border border-secondary/20 flex justify-between items-center group active:scale-95 transition-all shadow-premium border-l-4" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444' }}>
              <div className="flex gap-3 items-center">
                 <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center font-black text-text border border-secondary/20">
                    {t.type === 'income' ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                 </div>
                 <div>
                    <h4 className="text-[11px] font-black text-text uppercase tracking-tight">{t.category}</h4>
                    <p className="text-[9px] font-bold text-muted italic">{t.description || 'Sem descrição'}</p>
                    <div className="flex items-center gap-1 mt-1">
                       <span className="text-[8px] font-black uppercase text-primary/60">{t.creatorName?.split(' ')[0]}</span>
                       <span className="text-[8px] font-bold text-muted">• {format(new Date(t.date), 'dd/MM')}</span>
                    </div>
                 </div>
              </div>
              <div className="text-right">
                 <p className={cn("text-xs font-black", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                 </p>
                 <div className="flex gap-1 justify-end mt-2">
                    <button onClick={() => { setEditingTransaction(t); setFormData({ type: t.type, category: t.category, amount: t.amount, date: format(new Date(t.date), 'yyyy-MM-dd'), description: t.description || '' }); setIsModalOpen(true); }} className="p-1.5 bg-secondary/10 rounded-lg text-text"><Edit3 className="w-3 h-3" /></button>
                    {deleteConfirm === t.id ? (
                      <button onClick={async () => { await deleteDoc(doc(db, 'transactions', t.id)); setDeleteConfirm(null); }} className="p-1.5 bg-red-500 rounded-lg text-white font-black text-[9px] uppercase animate-in fade-in zoom-in">EXCLUIR?</button>
                    ) : (
                      <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 bg-red-50 rounded-lg text-red-500"><Trash2 className="w-3 h-3" /></button>
                    )}
                 </div>
              </div>
           </div>
         ))}
      </div>

      {/* Commission Cards */}
      <div className="pt-8 border-t border-secondary/20">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 px-1">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
               <PieChart className="w-4 h-4 text-accent" /> Comissões por Profissional
            </h3>
            
            <div className="flex items-center gap-2 bg-white border border-secondary p-2 rounded-xl shadow-sm">
               <Clock className="w-3 h-3 text-accent" />
               <input 
                  type="date" 
                  value={commStartDate} 
                  onChange={(e) => setCommStartDate(e.target.value)} 
                  className="text-[9px] font-black uppercase bg-transparent border-none p-0 focus:ring-0" 
               />
               <span className="text-[9px] font-black text-muted">até</span>
               <input 
                  type="date" 
                  value={commEndDate} 
                  onChange={(e) => setCommEndDate(e.target.value)} 
                  className="text-[9px] font-black uppercase bg-transparent border-none p-0 focus:ring-0" 
               />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffCommissions.map(s => (
               <div key={s.id} className="mobile-card p-5 bg-white border border-secondary shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-accent/5 rounded-bl-3xl flex items-center justify-center font-black text-accent/30">{s.name?.[0]}</div>
                  <h4 className="text-xs font-black text-text uppercase tracking-tighter mb-1">{s.name}</h4>
                  <div className="flex items-center gap-2">
                     <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{s.count} Serviços</p>
                     <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{s.percent}%</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-secondary/10 space-y-3">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500"></div>
                           <p className="text-[8px] font-black text-muted uppercase tracking-widest">Entrada Total</p>
                        </div>
                        <p className="text-sm font-black text-green-600">{formatCurrency(s.revenue)}</p>
                     </div>
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-accent"></div>
                           <p className="text-[8px] font-black text-muted uppercase tracking-widest">Comissão ({s.percent}%)</p>
                        </div>
                        <p className="text-sm font-black text-accent">{formatCurrency(s.total)}</p>
                     </div>
                     <div className="flex justify-between items-center pt-3 border-t border-secondary/10">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Lucro Líquido</p>
                        <p className="text-lg font-black text-text leading-none">{formatCurrency(s.revenue - s.total)}</p>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => {setIsModalOpen(false); setEditingTransaction(null);}} className="absolute top-8 right-8 p-2 hover:bg-secondary/20 rounded-full transition-colors"><X className="w-6 h-6 text-muted" /></button>
            <h3 className="text-2xl font-black tracking-tighter mb-8 uppercase flex items-center gap-3"><DollarSign className="w-8 h-8 text-primary" /> {editingTransaction ? 'Editar' : 'Lançar'} Valor</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="flex bg-secondary/10 p-1 rounded-2xl">
                  <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-muted")}>Receita</button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-muted")}>Despesa</button>
               </div>
               <div className="space-y-4">
                  <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Categoria</label><input required className="input-field py-4 font-bold" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="Ex: Produto, Luz, Aluguel" /></div>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Valor (R$)</label><input required type="number" step="0.01" className="input-field py-4 font-bold" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} /></div>
                     <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Data</label><input required type="date" className="input-field py-4 font-bold" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
                  </div>
                  <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Descrição Adicional</label><textarea className="input-field min-h-[100px] py-4 font-bold" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
               </div>
               <button type="submit" className="w-full btn-primary py-5 text-xs font-black uppercase tracking-widest rounded-3xl shadow-lg shadow-primary/20">Salvar Lançamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FinancialCard({ title, value, icon: Icon, color, trend }: any) {
  return (
    <div className="mobile-card p-6 bg-white border border-secondary shadow-premium relative overflow-hidden group">
      <div className={cn("absolute top-0 right-0 w-16 h-16 opacity-5 rounded-bl-[4rem]", color)} />
      <div className="flex justify-between items-start">
         <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}><Icon className="w-6 h-6" /></div>
         {trend && <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase", trend.includes('+') ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{trend}</span>}
      </div>
      <div className="mt-6">
         <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{title}</p>
         <h3 className="text-2xl font-black text-text tracking-tighter leading-none">{formatCurrency(value)}</h3>
      </div>
    </div>
  );
}
