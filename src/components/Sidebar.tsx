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
  ShoppingCart,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';

interface SidebarProps {
  onClose?: () => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ onClose, className, collapsed = false, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const { isAdmin, isAgente, user, profile } = useAuth();

  // Menu organizado por grupo de função, pra facilitar achar as coisas
  // (pedido de acessibilidade/usabilidade da cliente).
  const groups = [
    {
      label: 'Principal',
      items: [
        { icon: LayoutDashboard, label: 'Início', path: '/' },
        { icon: Calendar, label: isAdmin ? 'Agenda' : 'Serviços', path: '/agenda' },
      ]
    },
    {
      label: 'Clientes & Vendas',
      items: [
        { icon: UserCircle, label: 'Clientes', path: '/clientes' },
        { icon: MessageCircle, label: 'Caixa de Entrada', path: '/conversas' },
        { icon: Package, label: 'Produtos', path: '/produtos' },
        ...(isAdmin ? [{ icon: ShoppingCart, label: 'Vender Produtos', path: '/vendas' }] : []),
      ]
    },
    ...(isAdmin ? [{
      label: 'Financeiro',
      items: [
        { icon: Banknote, label: 'Fluxo de Caixa', path: '/caixa' },
        { icon: DollarSign, label: 'Financeiro Geral', path: '/financeiro' },
      ]
    }] : []),
    ...(isAdmin ? [{
      label: 'Studio',
      items: [
        { icon: Users, label: 'Equipe', path: '/equipe' },
        { icon: Settings, label: 'Serviços do Studio', path: '/servicos' },
      ]
    }] : []),
  ];

  const roleLabel = isAdmin ? 'Admin' : isAgente ? 'Agente' : 'Equipe';
  const roleBadgeClass = isAdmin ? 'badge-primary' : 'badge-neutral';
  const displayName = profile?.name || user?.displayName || user?.email || 'Studio Alê';
  const initial = displayName?.[0]?.toUpperCase() || 'A';

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "w-64 bg-white border-r border-slate-100 flex flex-col h-full shadow-sm z-50 transition-[width] duration-300 ease-in-out",
        collapsed ? "lg:w-[80px]" : "lg:w-64",
        className
      )}
    >
      <div className={cn("p-5 flex items-center gap-3", collapsed ? "lg:justify-center lg:px-0" : "justify-between")}>
        <div className={cn("flex items-center gap-3 min-w-0", collapsed && "lg:justify-center")}>
          <div className="bg-primary/10 p-2 rounded-lg shrink-0">
            <Scissors className="text-primary w-5 h-5" />
          </div>
          <h1 className={cn(
            "text-[15px] font-semibold text-text tracking-tight truncate transition-all duration-200",
            collapsed && "lg:hidden"
          )}>
            Estúdio da <span className="text-primary">Alê</span>
          </h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-50 rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-muted" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto overflow-x-hidden">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className={cn(
              "px-3 text-[10px] font-semibold uppercase tracking-widest text-muted/60 truncate",
              collapsed && "lg:hidden"
            )}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm",
                      collapsed && "lg:justify-center",
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:bg-slate-50 hover:text-text"
                    )
                  }
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className={cn("font-medium truncate", collapsed && "lg:hidden")}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Recolher/Expandir — só existe no desktop; no celular a sidebar vira
          gaveta/menu inferior (ver Layout.tsx), não precisa recolher. */}
      {onToggleCollapse && (
        <div className="hidden lg:block px-3 pb-1">
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-muted hover:bg-slate-50 hover:text-text transition-all duration-150 text-sm font-medium",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" /> : <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />}
            {!collapsed && <span>Recolher menu</span>}
          </button>
        </div>
      )}

      {/* Info do usuário logado */}
      <div className={cn("px-3 pb-2", collapsed && "lg:flex lg:justify-center")}>
        <div
          className={cn(
            "rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3 transition-all",
            collapsed ? "lg:p-0 lg:bg-transparent lg:border-0 p-3" : "p-3"
          )}
          title={collapsed ? `${displayName} · ${roleLabel}` : undefined}
        >
          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary-dark font-semibold text-xs flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <p className="text-xs font-semibold text-text truncate">{displayName}</p>
            <span className={cn(roleBadgeClass, "mt-1 !py-0.5 !px-2")}>{roleLabel}</span>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          aria-label="Sair"
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150 text-sm",
            collapsed && "lg:justify-center"
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span className={cn("font-medium", collapsed && "lg:hidden")}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
