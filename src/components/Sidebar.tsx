import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Package, 
  Calendar, 
  DollarSign, 
  LogOut,
  Scissors,
  Settings,
  X,
  Banknote,
  Command
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';

interface SidebarProps {
  onClose?: () => void;
  className?: string;
}

export default function Sidebar({ onClose, className }: SidebarProps) {
  const navigate = useNavigate();
  const { isAdmin, isAgente, user, profile } = useAuth();

  const publicItems = [
    { icon: LayoutDashboard, label: 'Painel', path: '/' },
    { icon: Calendar, label: isAdmin ? 'Agenda' : 'Serviços', path: '/agenda' },
    { icon: UserCircle, label: 'Clientes', path: '/clientes' },
    { icon: Package, label: 'Produtos', path: '/produtos' },
  ];

  if (isAdmin) {
    publicItems.push({ icon: Banknote, label: 'Caixa', path: '/caixa' });
  }

  const adminItems = [
    { icon: Users, label: 'Equipe', path: '/equipe' },
    { icon: DollarSign, label: 'Operacional', path: '/financeiro' },
    { icon: Settings, label: 'Configurações', path: '/servicos' },
  ];

  const menuItems = isAdmin
    ? [...publicItems, ...adminItems]
    : publicItems;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <aside className={cn("w-72 bg-primary border-r border-white/5 flex flex-col h-full shadow-2xl z-50", className)}>
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-accent p-3 rounded-2xl shadow-xl shadow-accent/20 group-hover:rotate-12 transition-transform">
            <Scissors className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-text tracking-tighter uppercase leading-none">
              Estúdio <span className="metallic-gold font-black">Alê</span>
            </h1>
            <p className="text-[8px] font-black tracking-[0.4em] text-muted uppercase mt-1 opacity-40">Luxury Management</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-3 hover:bg-white/5 rounded-2xl transition-colors">
            <X className="w-6 h-6 text-muted" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-8 space-y-3 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                isActive 
                  ? "bg-secondary/40 text-accent shadow-premium" 
                  : "text-muted hover:text-text hover:bg-white/5"
              )
            }
          >
            <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110")} />
            <span className="font-black text-[11px] uppercase tracking-[0.25em]">{item.label}</span>
            {/* Active Indicator */}
            {/* Using a metallic bar */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-accent rounded-r-full opacity-0 [isActive ? 'opacity-100' : 'opacity-0']" />
          </NavLink>
        ))}

        {isAdmin && (
           <div className="pt-8 pb-4">
              <p className="px-6 text-[9px] font-black uppercase tracking-[0.5em] text-muted/30">
                 Command Center
              </p>
           </div>
        )}
      </nav>

      {/* Profile & Footer */}
      <div className="p-6 space-y-6">
        <div className="p-5 rounded-3xl bg-secondary/20 border border-white/5 flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
             {profile?.name?.[0] || <Command className="w-5 h-5" />}
          </div>
          <div className="truncate">
            <p className="text-[10px] font-black text-text uppercase tracking-tighter truncate">{profile?.name || user?.email}</p>
            <p className="text-[8px] font-black text-accent uppercase tracking-widest opacity-60 italic">{isAdmin ? 'Proprietário' : 'Especialista'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-4 w-full px-6 py-4 text-muted hover:text-red-400 hover:bg-red-500/5 rounded-2xl transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-black text-[11px] uppercase tracking-widest">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
