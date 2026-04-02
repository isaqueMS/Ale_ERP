import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Scissors,
  DollarSign,
  Plus,
  ArrowRight,
  UserPlus,
  ShoppingBag,
  Bell
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, isAfter, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../lib/auth';
import { Appointment } from '../types';

export default function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [stats, setStats] = React.useState({
    clients: 0,
    appointments: 0,
    revenue: 0,
    products: 0,
    commissions: 0,
    revenueTrend: '+0%',
    revenueTrendUp: true
  });
  const [upcomingAppointments, setUpcomingAppointments] = React.useState<Appointment[]>([]);
  const [weeklyData, setWeeklyData] = React.useState<{ name: string; value: number }[]>([]);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  // Estados para dados brutos
  const [allTransactions, setAllTransactions] = React.useState<any[]>([]);
  const [allAppointments, setAllAppointments] = React.useState<Appointment[]>([]);
  const [allStaff, setAllStaff] = React.useState<any[]>([]);
  const [allServices, setAllServices] = React.useState<any[]>([]);

  const getIllustration = (category?: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('cabelo')) return '/portfolio_hair.png';
    if (cat.includes('unha')) return '/portfolio_nails.png';
    if (cat.includes('barba')) return '/portfolio_barber.png';
    if (cat.includes('estética') || cat.includes('pele')) return '/portfolio_skincare.png';
    return null;
  };

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listeners em tempo real para dados brutos
  React.useEffect(() => {
    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setStats(prev => ({ ...prev, clients: snap.size }));
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setStats(prev => ({ ...prev, products: snap.size }));
    });

    const unsubscribeAppointmentsLabels = onSnapshot(collection(db, 'appointments'), (snap) => {
      const apps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAllAppointments(apps);
    });

    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      const txs = snap.docs.map(doc => doc.data());
      setAllTransactions(txs);
    });

    const unsubscribeStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      const staffData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllStaff(staffData);
    });

    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snap) => {
      const servicesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllServices(servicesData);
    });

    return () => {
      unsubscribeClients();
      unsubscribeProducts();
      unsubscribeAppointmentsLabels();
      unsubscribeTransactions();
      unsubscribeStaff();
      unsubscribeServices();
    };
  }, []);

  // Cálculo de estatísticas baseado na data selecionada
  React.useEffect(() => {
    // --- FILTRAGEM DE PRIVACIDADE (NOVA) ---
    // Se não for admin, o atendente só vê o que é DELE (exclusividade total)
    const filteredAppointments = isAdmin ? allAppointments : allAppointments.filter(app => {
       // Tentar bater pelo staffId, ou pelo nome do atendente se o ID falhar (fallback robusto)
       return app.staffId === staffMember?.id || app.staffName === staffMember?.name;
    });

    // Transações: Staff só vê o que é originado dos SEUS agendamentos
    const filteredTransactions = isAdmin ? allTransactions : allTransactions.filter(t => {
       if (!t.appointmentId) return false;
       const relatedApp = allAppointments.find(a => a.id === t.appointmentId);
       return relatedApp?.staffId === staffMember?.id || relatedApp?.staffName === staffMember?.name;
    });

    const getStandardDate = (t: any) => {
      const val = t.date || t.createdAt;
      if (!val) return "";
      if (typeof val === 'string') return val.split('T')[0];
      if (typeof val?.toDate === 'function') return format(val.toDate(), 'yyyy-MM-dd');
      if (val instanceof Date) return format(val, 'yyyy-MM-dd');
      return "";
    };

    const dayTransactions = filteredTransactions.filter(t => getStandardDate(t) === selectedDate);
    const dayAppointments = filteredAppointments.filter(app => getStandardDate(app) === selectedDate);

    // Próximos atendimentos do dia (apenas os pertinentes ao usuário)
    setUpcomingAppointments(dayAppointments.sort((a, b) => a.date.localeCompare(b.date)));

    // Faturamento e Comissões do dia
    let dayRevenue = 0;
    let dayCommissions = 0;
    
    dayTransactions.forEach(t => {
      if (t.type === 'income') dayRevenue += Number(t.amount) || 0;
    });

    dayAppointments.forEach(app => {
      if (app.status === 'completed') dayCommissions += app.commissionAmount || 0;
    });

    // Desempenho Semanal (Filtrado por exclusividade)
    const baseDate = parseISO(selectedDate);
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const weekly = last7Days.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      let income = 0;
      filteredTransactions.forEach(t => {
        let tDate = t.date || t.createdAt;
        
        // Garantir que temos uma string no formato YYYY-MM-DD
        let finalTDate = '';
        if (tDate) {
          if (typeof tDate === 'string') {
            finalTDate = tDate.split('T')[0];
          } else if (tDate.toDate) { // Firestore Timestamp
            finalTDate = format(tDate.toDate(), 'yyyy-MM-dd');
          } else if (tDate instanceof Date) {
            finalTDate = format(tDate, 'yyyy-MM-dd');
          }
        }

        if (finalTDate === dStr && t.type === 'income') {
          income += Number(t.amount) || 0;
        }
      });
      return { 
        name: format(date, 'eee', { locale: ptBR }), 
        value: income 
      };
    });

    setStats(prev => ({
      ...prev,
      appointments: dayAppointments.length,
      revenue: dayRevenue,
      commissions: dayCommissions,
      revenueTrend: '+0%', // Simplificado por enquanto
      revenueTrendUp: true
    }));
    setWeeklyData(weekly);

  }, [selectedDate, allAppointments, allTransactions]);

  // Buscar profissional logado (por UID ou E-mail para garantir)
  const staffMember = allStaff.find(s => s.uid === user?.uid) || allStaff.find(s => s.email === user?.email);
  
  // Filtrar serviços habilitados (Case-Insensitive para garantir que carregue tudo)
  const staffSpecialties = (staffMember?.specialties || []).map(s => s.toLowerCase());
  const habilitatedServices = allServices.filter(s => 
     staffSpecialties.includes((s.category || 'Geral').toLowerCase())
  );

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen">
        <header className="flex justify-between items-center bg-white p-4 rounded-[2rem] shadow-premium border border-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/5">
              <span className="text-xl font-black text-primary">A</span>
            </div>
            <div>
               <h2 className="text-lg font-black text-text uppercase tracking-tighter leading-tight">Olá, Ale!</h2>
               <div className="flex items-center gap-2">
                 <Calendar className="w-3 h-3 text-primary" />
                 <input 
                   type="date" 
                   value={selectedDate} 
                   onChange={(e) => setSelectedDate(e.target.value)}
                   className="text-[9px] font-black text-muted uppercase tracking-widest bg-transparent border-none p-0 focus:ring-0"
                 />
               </div>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-muted"><Bell className="w-5 h-5" /></button>
        </header>

        {/* Portfolio Mobile (Only for Staff) - NOW AT THE TOP */}
        {!isAdmin && staffMember && (
           <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" /> Portfólio Profissional Completo
                 </h3>
                 <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-tighter">
                    {habilitatedServices.length} Procedimentos
                 </span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                 {habilitatedServices.map((s: any) => {
                    const specColor = s.category?.toLowerCase().includes('hair') || s.category === 'Cabelo' ? "border-primary" :
                                    s.category?.toLowerCase().includes('nail') || s.category === 'Unhas' ? "border-accent" :
                                    s.category?.toLowerCase().includes('barber') || s.category === 'Barba' ? "border-blue-500" : "border-emerald-500";
                    return (
                      <div key={s.id} className={cn("mobile-card p-4 bg-white border-l-4 shadow-sm flex flex-col justify-center animate-in slide-in-from-top duration-300", specColor)}>
                         <div className="flex justify-between items-start">
                            <div>
                               <span className="text-[7px] font-black uppercase text-muted tracking-[0.2em] mb-1 block">{s.category}</span>
                               <h4 className="text-sm font-black text-text uppercase tracking-tighter leading-tight">{s.name}</h4>
                            </div>
                            <div className="text-right">
                               <p className="text-base font-black text-accent tracking-tighter leading-none">{formatCurrency(s.price)}</p>
                            </div>
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        )}

        {/* Quick Actions Mobile */}
        <div className={cn("grid gap-3", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
           <QuickAction icon={Calendar} label={isAdmin ? "Agenda" : "Serviços"} onClick={() => navigate('/agenda')} color="bg-primary/10 text-primary" />
           {isAdmin && <QuickAction icon={ShoppingBag} label="Vender" onClick={() => navigate('/vendas')} color="bg-accent/10 text-accent" />}
           <QuickAction icon={UserPlus} label="Cliente" onClick={() => navigate('/clientes')} color="bg-green-100 text-green-600" />
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 gap-3 pb-20">
          <div className="mobile-card p-5 bg-white border border-secondary shadow-premium relative overflow-hidden flex flex-col justify-between h-32">
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><TrendingUp className="w-5 h-5" /></div>
                <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+{stats.revenueTrend} <ArrowUpRight className="w-2 h-2 inline" /></span>
             </div>
             <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Faturamento</p>
                <h3 className="text-2xl font-black text-text truncate leading-none">{isAdmin ? formatCurrency(stats.revenue) : formatCurrency(stats.commissions)}</h3>
             </div>
          </div>
          <div className="mobile-card p-5 bg-white border border-secondary shadow-premium relative overflow-hidden flex flex-col justify-between h-32">
             <div className="flex justify-between items-start">
                 <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent"><Calendar className="w-5 h-5" /></div>
                 <span className="text-[8px] font-black text-accent bg-accent/5 px-2 py-1 rounded-lg">LIVE</span>
             </div>
             <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Agendados</p>
                <h3 className="text-2xl font-black text-text leading-none">{stats.appointments}</h3>
             </div>
          </div>
        </div>

        {/* Weekly Performance Mobile */}
        {isAdmin && (
           <div className="mobile-card p-5 bg-white border border-secondary shadow-premium">
              <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desempenho Semanal</h3>
              <div className="h-[150px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                       <defs>
                         <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FFB7C5" stopOpacity={0.4}/><stop offset="95%" stopColor="#FFB7C5" stopOpacity={0}/></linearGradient>
                       </defs>
                       <Area type="monotone" dataKey="value" stroke="#FFB7C5" strokeWidth={3} fill="url(#mobileGrad)" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        )}

        {/* Upcoming List Mobile */}
        <div className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Atendimentos de Hoje</h3>
              <button onClick={() => navigate('/agenda')} className="text-[10px] font-black text-primary uppercase flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></button>
           </div>
           {upcomingAppointments.length === 0 ? (
             <div className="mobile-card p-10 text-center text-muted italic text-xs">Sem agendamentos hoje.</div>
           ) : (
             upcomingAppointments.map(app => (
               <div key={app.id} className="mobile-card p-4 bg-white border border-secondary/20 flex justify-between items-center shadow-premium">
                  <div className="flex gap-3 items-center">
                     <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center font-black text-text border border-secondary/20">{app.clientName?.[0] || '?'}</div>
                     <div>
                        <h4 className="text-xs font-black text-text uppercase tracking-tight truncate max-w-[120px]">{app.clientName}</h4>
                        <p className="text-[9px] font-bold text-muted">{app.serviceName}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="flex items-center gap-1 text-primary">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs font-black">{format(parseISO(app.date), 'HH:mm')}</span>
                     </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase",
                        app.status === 'completed' ? "text-green-600" : 
                        app.status === 'cancelled' ? "text-red-600" : "text-accent"
                      )}>
                        {app.status === 'scheduled' ? 'Agend.' : app.status === 'completed' ? 'Conclu.' : 'Canc.'}
                      </span>
                  </div>
               </div>
             ))
           )}
        </div>
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-text tracking-tighter uppercase leading-none">Visão Geral</h2>
          <p className="text-muted mt-2 font-bold italic tracking-wide">
            Bem-vind{profile?.name?.toLowerCase().includes('ale') ? 'a' : 'o'} de volta, {profile?.name?.split(' ')[0] || 'Alê'}! O estúdio está pronto.
          </p>
        </div>
        <div className="bg-white/70 backdrop-blur-md px-6 py-3 rounded-full border border-secondary shadow-premium flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary" />
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer"
          />
        </div>
      </header>

      {/* Portfolio Desktop (Only for Staff) - NOW AT THE TOP */}
      {!isAdmin && staffMember && (
         <div className="space-y-12 mb-12 animate-in slide-in-from-top duration-700">
            <header className="flex flex-col gap-2 border-b border-secondary/20 pb-8">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-black uppercase text-primary tracking-[0.4em]">Personal Portfolio</span>
               </div>
               <h2 className="text-4xl font-black text-text uppercase tracking-tighter">Meus Procedimentos</h2>
               <p className="text-muted font-bold text-sm uppercase opacity-40 tracking-wider">Garantiu-se o carregamento de todos os {habilitatedServices.length} serviços registrados para sua especialidade.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {habilitatedServices.map((s: any) => {
                  const specColor = s.category === 'Cabelo' ? "border-primary" :
                                    s.category === 'Unhas' ? "border-accent" :
                                    s.category === 'Barba' ? "border-blue-500" : "border-emerald-500";
                  return (
                    <div key={s.id} className={cn(
                       "glass-card p-6 bg-white shadow-premium transition-all hover:shadow-xl hover:-translate-y-1 border border-secondary/20 border-l-4 flex flex-col group",
                       specColor
                    )}>
                       <div className="flex flex-col justify-between h-full">
                          <header className="flex justify-between items-start mb-6">
                             <div>
                                <span className="text-[8px] font-black uppercase text-muted tracking-[0.3em] mb-1 block">{s.category || 'Geral'}</span>
                                <h4 className="text-lg font-black text-text uppercase tracking-tighter leading-tight group-hover:text-primary transition-colors">{s.name}</h4>
                             </div>
                             <div className="w-8 h-8 rounded-xl bg-secondary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                <Scissors className="w-4 h-4 text-primary" />
                             </div>
                          </header>
                          
                          <div className="mt-auto flex justify-between items-end border-t border-secondary/10 pt-4">
                             <div className="space-y-1">
                                <div className="flex items-center gap-1.5 opacity-40">
                                   <Clock className="w-3 h-3 text-text" />
                                   <span className="text-[9px] font-black text-text uppercase tracking-widest">{s.duration ?? 30} min</span>
                                </div>
                                <p className="text-xl font-black text-accent tracking-tighter leading-none">{formatCurrency(s.price)}</p>
                             </div>
                             <div className="px-3 py-1 bg-secondary/5 rounded-lg">
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted">Premium Care</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>
            
            {habilitatedServices.length === 0 && (
               <div className="p-20 text-center border-2 border-dashed border-secondary/30 rounded-3xl bg-secondary/5">
                  <p className="text-sm font-black text-muted uppercase tracking-widest">Nenhum serviço disponível para sua especialidade atual.</p>
               </div>
            )}
         </div>
      )}

      {/* Stats Cards Section - ERP REDESIGN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={isAdmin ? "TOTAL CLIENTES" : "MEUS CLIENTES"} 
          value={stats.clients.toString()} 
          icon={Users} 
          trend="+5%" 
          trendUp={true} 
          color="bg-primary/5 text-primary"
        />
        <StatCard 
          title={isAdmin ? "AGENDA TOTAL" : "MEUS AGENDAMENTOS"} 
          value={stats.appointments.toString()} 
          icon={Calendar} 
          trend="+2.4%" 
          trendUp={true} 
          color="bg-accent/5 text-accent"
        />
        {isAdmin && (
           <StatCard 
             title="FATURAMENTO" 
             value={formatCurrency(stats.revenue)} 
             icon={TrendingUp} 
             trend="+12.5%" 
             trendUp={true} 
             color="bg-green-50 text-green-600"
           />
        )}
        {!isAdmin && (
           <StatCard 
             title="COMISSÃO TOTAL" 
             value={formatCurrency(stats.commissions)} 
             icon={DollarSign} 
             trend="SALDO" 
             trendUp={true} 
             color="bg-emerald-50 text-emerald-600"
           />
        )}
        <StatCard 
          title="ESTOQUE" 
          value={stats.products.toString()} 
          icon={Package} 
          trend="ITENS" 
          trendUp={true} 
          color="bg-secondary/10 text-muted"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isAdmin && (
          <div className="glass-card p-8 bg-white/80 shadow-premium">
            <h3 className="text-xs font-black text-muted uppercase tracking-widest mb-8 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Desempenho de Vendas</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs><linearGradient id="deskGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FFB7C5" stopOpacity={0.3}/><stop offset="95%" stopColor="#FFB7C5" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5E6D3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10, fontWeight: 800 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#FFB7C5" strokeWidth={5} fill="url(#deskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={cn("glass-card p-8 bg-white/80 shadow-premium", !isAdmin && "lg:col-span-2")}>
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black text-muted uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Próximos Atendimentos</h3>
            <button onClick={() => navigate('/agenda')} className="btn-secondary py-2 px-4 text-[10px] font-black uppercase">Ver Agenda Completa</button>
          </div>
          <div className="space-y-4">
            {upcomingAppointments.map((app) => (
              <div key={app.id} className="flex items-center justify-between p-5 rounded-3xl bg-secondary/5 border border-secondary/10 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-white shadow-sm flex items-center justify-center font-black text-primary text-xl border border-secondary/20 group-hover:bg-primary group-hover:text-white transition-colors">{app.clientName?.[0] || '?'}</div>
                  <div>
                    <p className="font-black text-text uppercase tracking-tighter text-lg">{app.clientName}</p>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest italic">{app.serviceName} • {format(parseISO(app.date), 'HH:mm')}</p>
                  </div>
                </div>
                <div className="text-right">
                   <span className={cn( 
                     "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", 
                     app.status === 'completed' ? "bg-green-50 text-green-700 border-green-100" : 
                     app.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-100" :
                     "bg-primary/5 text-primary border-primary/10" 
                   )}> 
                    {app.status === 'scheduled' ? 'Agendado' : app.status === 'completed' ? 'Concluído' : 'Cancelado'} 
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, color }: any) {
  return (
    <div className="glass-card p-6 bg-white shadow-premium transition-all hover:shadow-xl hover:-translate-y-1 border border-secondary/20 flex flex-col justify-between h-52 relative overflow-hidden group">
      <header className="flex justify-between items-start">
         <div className={cn("w-14 h-14 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500", color || "bg-primary/10 text-primary")}>
            <Icon className="w-7 h-7" />
         </div>
         <div className={cn(
            "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-sm",
            trendUp ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
         )}>
            {trend} <ArrowUpRight className={cn("w-3 h-3", !trendUp && "rotate-90")} />
         </div>
      </header>
      
      <div className="mt-8">
         <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1 block opacity-50">{title}</span>
         <h4 className="text-4xl font-black text-text tracking-tighter leading-none group-hover:text-primary transition-colors">{value}</h4>
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-secondary/5 rounded-full blur-2xl group-hover:bg-primary/5 transition-colors" />
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, color }: any) {
   return (
      <button onClick={onClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-[2rem] shadow-premium border border-secondary/20 active:scale-90 transition-all">
         <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", color)}><Icon className="w-6 h-6" /></div>
         <span className="text-[9px] font-black text-text uppercase tracking-tighter">{label}</span>
      </button>
   );
}
