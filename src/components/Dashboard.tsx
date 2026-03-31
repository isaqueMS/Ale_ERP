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
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
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

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setStats(prev => ({ ...prev, clients: snap.size }));
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setStats(prev => ({ ...prev, products: snap.size }));
    });

    const unsubscribeAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      const appointments = snap.docs.map(doc => doc.data() as Appointment);
      let totalCommissions = 0;
      appointments.forEach(app => {
        if (app.status === 'completed') totalCommissions += app.commissionAmount || 0;
      });
      setStats(prev => ({ ...prev, appointments: snap.size, commissions: totalCommissions }));
    });

    let unsubscribeTransactions: () => void = () => {};
    if (isAdmin) {
      unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
        let totalRevenue = 0;
        let lastMonthRevenue = 0;
        const now = new Date();
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        const transactions = snap.docs.map(doc => doc.data());
        
        transactions.forEach(t => {
          if (t.type === 'income') {
            totalRevenue += Number(t.amount) || 0;
            if (isWithinInterval(new Date(t.date), { start: lastMonthStart, end: lastMonthEnd })) {
              lastMonthRevenue += Number(t.amount) || 0;
            }
          }
        });

        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date;
        });

        const weekly = last7Days.map(date => {
          let income = 0;
          transactions.forEach(t => {
            if (format(new Date(t.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
              if (t.type === 'income') income += Number(t.amount) || 0;
            }
          });
          return { name: format(date, 'eee', { locale: ptBR }), value: income };
        });

        const trend = lastMonthRevenue > 0 ? (((totalRevenue / 2) - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0) : '0';
        setStats(prev => ({ ...prev, revenue: totalRevenue, revenueTrend: `${Number(trend) >= 0 ? '+' : ''}${trend}%`, revenueTrendUp: Number(trend) >= 0 }));
        setWeeklyData(weekly);
      });
    }

    const qUpcoming = query(collection(db, 'appointments'), where('status', '==', 'scheduled'), orderBy('date', 'asc'), limit(5));
    const unsubscribeUpcoming = onSnapshot(qUpcoming, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setUpcomingAppointments(apps);
    });

    return () => {
      unsubscribeClients(); unsubscribeProducts(); unsubscribeAppointments(); unsubscribeTransactions(); unsubscribeUpcoming();
    };
  }, [isAdmin]);

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
               <p className="text-[9px] font-black text-muted uppercase tracking-widest">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-muted"><Bell className="w-5 h-5" /></button>
        </header>

        {/* Quick Actions Mobile */}
        <div className="grid grid-cols-3 gap-3">
           <QuickAction icon={Calendar} label="Agenda" onClick={() => navigate('/agenda')} color="bg-primary/10 text-primary" />
           <QuickAction icon={ShoppingBag} label="Vender" onClick={() => navigate('/caixa')} color="bg-accent/10 text-accent" />
           <QuickAction icon={UserPlus} label="Cliente" onClick={() => navigate('/clientes')} color="bg-green-100 text-green-600" />
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="mobile-card p-4 bg-white border border-secondary shadow-premium relative overflow-hidden">
             <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rounded-bl-[2rem] flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary/30" /></div>
             <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Faturamento</p>
             <h3 className="text-lg font-black text-text truncate">{isAdmin ? formatCurrency(stats.revenue) : '***'}</h3>
             <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">+{stats.revenueTrend}</span>
          </div>
          <div className="mobile-card p-4 bg-white border border-secondary shadow-premium relative overflow-hidden">
             <div className="absolute top-0 right-0 w-12 h-12 bg-accent/5 rounded-bl-[2rem] flex items-center justify-center"><Calendar className="w-5 h-5 text-accent/30" /></div>
             <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Agendados</p>
             <h3 className="text-lg font-black text-text">{stats.appointments}</h3>
             <span className="text-[8px] font-black text-muted lowercase mt-2 inline-block">Proximos dias</span>
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
                     <span className="text-[8px] font-black uppercase text-accent">{app.status === 'confirmed' ? 'Confir.' : 'Agend.'}</span>
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
          <span className="text-xs font-black uppercase tracking-widest">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="MEUS CLIENTES" value={stats.clients.toString()} icon={Users} trend="+5%" trendUp={true} />
        <StatCard title="AGENDA TOTAL" value={stats.appointments.toString()} icon={Calendar} trend="+2%" trendUp={true} />
        {isAdmin && <StatCard title="FATURAMENTO" value={formatCurrency(stats.revenue)} icon={TrendingUp} trend={stats.revenueTrend} trendUp={stats.revenueTrendUp} />}
        <StatCard title="ESTOQUE" value={stats.products.toString()} icon={Package} trend="Itens" trendUp={true} />
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
                   <span className={cn( "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", app.status === 'confirmed' ? "bg-green-50 text-green-700 border-green-100" : "bg-primary/5 text-primary border-primary/10" )}> {app.status === 'confirmed' ? 'Confirmado' : 'Aguardando'} </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: any) {
  return (
    <div className="glass-card p-7 flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-2 border border-secondary/30 bg-white/90 shadow-premium">
      <div className="flex justify-between items-start">
        <div className="bg-primary/10 p-4 rounded-[1.5rem] shadow-inner text-primary"><Icon className="w-7 h-7" /></div>
        <div className={cn( "flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter", trendUp ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50" )}>{trend} {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}</div>
      </div>
      <div className="mt-8">
        <p className="text-muted text-[10px] font-black uppercase tracking-widest opacity-60">{title}</p>
        <h4 className="text-3xl font-black text-text mt-1 tracking-tighter leading-none">{value}</h4>
      </div>
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
