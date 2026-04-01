import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Package, 
  ArrowUpRight, 
  Clock,
  Scissors,
  DollarSign,
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
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
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
    revenueTrend: '+12%',
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

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listeners em tempo real
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

  // Buscar profissional logado
  const staffMember = allStaff.find(s => s.uid === user?.uid) || allStaff.find(s => s.email === user?.email);
  
  // Filtrar serviços habilitados
  const staffSpecialties = (staffMember?.specialties || []).map((s: string) => s.toLowerCase());
  const habilitatedServices = allServices.filter(s => 
     staffSpecialties.includes((s.category || 'Geral').toLowerCase())
  );

  // Processamento de dados
  React.useEffect(() => {
    const filteredAppointments = isAdmin ? allAppointments : allAppointments.filter(app => {
       return app.staffId === staffMember?.id || app.staffName === staffMember?.name;
    });

    const dayAppointments = filteredAppointments.filter(app => app.date.startsWith(selectedDate));
    
    const filteredTransactions = isAdmin ? allTransactions : allTransactions.filter(t => {
       if (!t.appointmentId) return false;
       const relatedApp = allAppointments.find(a => a.id === t.appointmentId);
       return relatedApp?.staffId === staffMember?.id || relatedApp?.staffName === staffMember?.name;
    });

    const dayTransactions = filteredTransactions.filter(t => (t.date || t.createdAt)?.startsWith(selectedDate));

    setUpcomingAppointments(dayAppointments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5));

    let dayRevenue = 0;
    let dayCommissions = 0;
    
    dayTransactions.forEach(t => {
      if (t.type === 'income') dayRevenue += Number(t.amount) || 0;
    });

    dayAppointments.forEach(app => {
      if (app.status === 'completed') dayCommissions += app.commissionAmount || 0;
    });

    // Gráfico Semanal
    const baseDate = parseISO(selectedDate);
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - (6 - i));
      const dStr = format(d, 'yyyy-MM-dd');
      let income = 0;
      filteredTransactions.forEach(t => {
         const tDate = t.date || t.createdAt;
         if (tDate?.startsWith(dStr) && t.type === 'income') income += Number(t.amount);
      });
      return { name: format(d, 'eee', { locale: ptBR }), value: income };
    });

    setStats(prev => ({
      ...prev,
      appointments: dayAppointments.length,
      revenue: dayRevenue,
      commissions: dayCommissions
    }));
    setWeeklyData(weekly);

  }, [selectedDate, allAppointments, allTransactions, isAdmin, staffMember]);

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-background min-h-screen">
        <header className="flex justify-between items-center bg-secondary/30 backdrop-blur-3xl p-5 rounded-[2.5rem] shadow-premium border border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-2xl shadow-accent/20">
              <span className="text-2xl font-black text-white">A</span>
            </div>
            <div>
               <h2 className="text-xl font-black text-text uppercase tracking-tighter leading-none">Olá, <span className="metallic-gold">{profile?.name?.split(' ')[0] || 'Ale'}!</span></h2>
               <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-3 h-3 text-accent" />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-[10px] font-black text-muted uppercase tracking-widest bg-transparent border-none p-0 focus:ring-0"
                  />
               </div>
            </div>
          </div>
          <button className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center text-muted border border-white/5"><Bell className="w-6 h-6" /></button>
        </header>

        {!isAdmin && staffMember && (
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-accent" /> Portfólio de Luxo
                 </h3>
                 <span className="text-[9px] font-black text-accent bg-accent/10 px-3 py-1 rounded-full uppercase tracking-tighter border border-accent/20">
                    {habilitatedServices.length} Serviços
                 </span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                 {habilitatedServices.slice(0, 4).map((s: any) => (
                    <div key={s.id} className="mobile-card border-l-4 border-accent flex flex-col justify-center">
                       <div className="flex justify-between items-center">
                          <div>
                             <span className="text-[7px] font-black uppercase text-muted tracking-widest block mb-1">{s.category}</span>
                             <h4 className="text-[13px] font-black text-text uppercase tracking-tighter">{s.name}</h4>
                          </div>
                          <p className="text-lg font-black text-accent tracking-tighter">{formatCurrency(s.price)}</p>
                       </div>
                    </div>
                 ))}
                 <button onClick={() => navigate('/servicos')} className="text-[10px] font-black text-muted uppercase tracking-widest text-center py-2 opacity-50">+ Ver portfólio completo</button>
              </div>
           </div>
        )}

        <div className={cn("grid gap-4", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
           <QuickAction icon={Calendar} label={isAdmin ? "Agenda" : "Serviços"} onClick={() => navigate('/agenda')} color="bg-accent/10 text-accent" />
           {isAdmin && <QuickAction icon={ShoppingBag} label="Venda" onClick={() => navigate('/caixa')} color="bg-white/5 text-white" />}
           <QuickAction icon={UserPlus} label="Cliente" onClick={() => navigate('/clientes')} color="bg-accent/5 text-accent" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="mobile-card border-white/5 flex flex-col justify-between h-36">
             <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shadow-inner"><TrendingUp className="w-6 h-6" /></div>
                <span className="text-[9px] font-black text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">UP</span>
             </div>
             <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Resultado</p>
                <h3 className="text-2xl font-black text-text leading-none">{isAdmin ? formatCurrency(stats.revenue) : formatCurrency(stats.commissions)}</h3>
             </div>
          </div>
          <div className="mobile-card border-white/5 flex flex-col justify-between h-36">
             <div className="flex justify-between items-start">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white"><Clock className="w-6 h-6" /></div>
                 <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
             </div>
             <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Agendados</p>
                <h3 className="text-3xl font-black text-text leading-none">{stats.appointments}</h3>
             </div>
          </div>
        </div>

        <div className="space-y-4">
           <h3 className="text-[11px] font-black text-muted uppercase tracking-[0.2em] px-2 text-center">Fila de Atendimento</h3>
           {upcomingAppointments.length === 0 ? (
             <div className="mobile-card p-12 text-center text-muted italic text-[11px] uppercase tracking-widest border-dashed opacity-40">Nenhum comando para hoje.</div>
           ) : (
             upcomingAppointments.map(app => (
               <div key={app.id} className="mobile-card border-white/5 flex justify-between items-center bg-secondary/20">
                  <div className="flex gap-4 items-center">
                     <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-white text-lg border border-white/5">{app.clientName?.[0]}</div>
                     <div>
                        <h4 className="text-sm font-black text-text uppercase tracking-tighter">{app.clientName}</h4>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wide">{app.serviceName}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-black text-accent">{format(parseISO(app.date), 'HH:mm')}</p>
                     <span className="text-[8px] font-black uppercase text-muted tracking-widest">{app.status}</span>
                  </div>
               </div>
             ))
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="industrial-header">Comando <span className="metallic-gold">Central</span></h2>
          <p className="text-muted mt-4 font-black uppercase text-xs tracking-[0.4em] opacity-40">
            Industrial Luxury ERP • {profile?.name || 'Administrador'}
          </p>
        </div>
        <div className="bg-secondary/40 backdrop-blur-3xl px-10 py-6 rounded-[2.5rem] border border-white/5 shadow-2xl flex items-center gap-6 group">
          <Calendar className="w-6 h-6 text-accent group-hover:rotate-12 transition-transform" />
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-black uppercase tracking-[0.2em] bg-transparent border-none focus:ring-0 cursor-pointer text-text"
          />
        </div>
      </header>

      {!isAdmin && staffMember && (
         <div className="animate-in slide-in-from-top duration-1000">
            <div className="flex items-center gap-4 mb-8">
               <div className="h-px flex-1 bg-white/5" />
               <span className="text-[10px] font-black uppercase text-muted tracking-[0.5em]">Meus Procedimentos Premium</span>
               <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {habilitatedServices.map((s: any) => (
                 <div key={s.id} className="glass-card p-10 border-l-8 border-accent group hover:bg-secondary/40 transition-all cursor-pointer relative overflow-hidden">
                    <div className="relative z-10">
                       <span className="text-[9px] font-black text-muted uppercase tracking-[0.3em] mb-2 block">{s.category}</span>
                       <h4 className="text-2xl font-black text-text uppercase tracking-tighter leading-none mb-6 group-hover:metallic-gold transition-all">{s.name}</h4>
                       <div className="flex justify-between items-end">
                          <p className="text-3xl font-black text-accent tracking-tighter">{formatCurrency(s.price)}</p>
                          <Clock className="w-5 h-5 text-muted opacity-20 group-hover:opacity-100 transition-opacity" />
                       </div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                       <Scissors className="w-24 h-24 text-white" />
                    </div>
                 </div>
               ))}
            </div>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="Total Clientes" value={stats.clients.toString()} icon={Users} trend="+12%" trendUp={true} />
        <StatCard title="Agendamentos" value={stats.appointments.toString()} icon={Calendar} trend="Hoje" trendUp={true} color="bg-white/5 text-white" />
        <StatCard title="Receita Bruta" value={formatCurrency(isAdmin ? stats.revenue : stats.commissions)} icon={isAdmin ? TrendingUp : DollarSign} trend="+8%" trendUp={true} />
        <StatCard title="Items Estoque" value={stats.products.toString()} icon={Package} trend="Live" trendUp={true} color="bg-secondary/20 text-muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 glass-card p-12 bg-secondary/20 h-[500px]">
           <div className="flex justify-between items-center mb-12">
              <h3 className="text-[11px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-3"><TrendingUp className="w-5 h-5 text-accent" /> Fluxo de Crescimento</h3>
              <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-xl border border-accent/20">
                 <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                 <span className="text-[9px] font-black text-accent uppercase tracking-widest">Tempo Real</span>
              </div>
           </div>
           <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={weeklyData}>
                 <defs>
                    <linearGradient id="luxGrad" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2}/>
                       <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#ffffff05" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontWeight: 900 }} dy={10} />
                 <YAxis hide />
                 <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff' }} />
                 <Area type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={4} fill="url(#luxGrad)" />
              </AreaChart>
           </ResponsiveContainer>
        </div>

        <div className="glass-card p-10 bg-secondary/30 relative overflow-hidden">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Operações Hoje</h3>
              <ArrowRight className="w-5 h-5 text-accent group-hover:translate-x-2 transition-transform cursor-pointer" onClick={() => navigate('/agenda')} />
           </div>
           <div className="space-y-6">
              {upcomingAppointments.length === 0 ? (
                 <div className="h-64 flex items-center justify-center text-muted font-black uppercase text-[10px] tracking-[0.5em] border border-white/5 rounded-3xl border-dashed">Vazio</div>
              ) : (
                 upcomingAppointments.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-6 rounded-[2.5rem] bg-background/50 border border-white/5 hover:border-accent/40 transition-all group">
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center font-black text-text text-xl border border-white/5 group-hover:bg-accent group-hover:text-white transition-all shadow-xl">{app.clientName?.[0]}</div>
                          <div>
                             <h4 className="text-lg font-black text-text uppercase tracking-tighter group-hover:metallic-gold">{app.clientName}</h4>
                             <p className="text-[10px] font-black text-muted uppercase tracking-widest">{app.serviceName}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xl font-black text-accent">{format(parseISO(app.date), 'HH:mm')}</p>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, color }: any) {
  return (
    <div className="glass-card p-10 transition-all hover:shadow-[0_0_50px_rgba(212,175,55,0.1)] hover:border-accent/30 hover:-translate-y-2 flex flex-col justify-between h-64 relative overflow-hidden group">
      <header className="flex justify-between items-start">
         <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-all duration-500 border border-white/10", color || "bg-accent/10 text-accent")}>
            <Icon className="w-8 h-8" />
         </div>
         <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
            {trend}
         </div>
      </header>
      
      <div className="mt-10 relative z-10">
         <span className="text-[11px] font-black text-muted uppercase tracking-[0.4em] mb-2 block opacity-40">{title}</span>
         <h4 className="text-5xl font-black text-text tracking-tighter leading-none group-hover:metallic-gold transition-all duration-700">{value}</h4>
      </div>
      
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-accent/5 rounded-full blur-[100px] group-hover:bg-accent/10 transition-all" />
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, color }: any) {
   return (
      <button onClick={onClick} className="flex flex-col items-center gap-3 p-6 bg-secondary/30 backdrop-blur-3xl rounded-[2.5rem] shadow-premium border border-white/5 active:scale-95 active:bg-secondary/50 transition-all group">
         <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all", color || "bg-accent/10 text-accent")}><Icon className="w-7 h-7" /></div>
         <span className="text-[11px] font-black text-text uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">{label}</span>
      </button>
   );
}
