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
  ShoppingCart
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
  const { isAdmin, isAgente, user } = useAuth();

  // Itens visíveis para todos os usuários autenticados
  // Itens visíveis para todos
  const publicItems = [
    { icon: LayoutDashboard, label: 'Início', path: '/' },
    { icon: Calendar, label: isAdmin ? 'Agenda' : 'Serviços', path: '/agenda' },
    { icon: UserCircle, label: 'Clientes', path: '/clientes' },
    { icon: Package, label: 'Produtos', path: '/produtos' },
  ];

  if (isAdmin) {
    publicItems.push({ icon: ShoppingCart, label: 'Vender Produtos', path: '/vendas' });
    publicItems.push({ icon: Banknote, label: 'Fluxo de Caixa', path: '/caixa' });
  }

  // Itens exclusivos do administrador
  const adminItems = [
    { icon: Users, label: 'Equipe', path: '/equipe' },
    { icon: DollarSign, label: 'Financeiro Geral', path: '/financeiro' },
    { icon: Settings, label: 'Serviços do Studio', path: '/servicos' },
  ];

  const menuItems = isAdmin
    ? [...publicItems, ...adminItems]
    : publicItems;

  const roleLabel = isAdmin ? "ADMIN" : isAgente ? "AGENTE" : "COMUM";
  const roleColor = isAdmin ? "text-green-600" : isAgente ? "text-blue-600" : "text-red-600";

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <aside className={cn("w-64 bg-white border-r border-secondary flex flex-col h-full shadow-sm z-50", className)}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-xl">
            <Scissors className="text-primary w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-text tracking-tight">
            Estúdio da <span className="text-primary">Alê</span>
          </h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-secondary/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-muted hover:bg-secondary/30 hover:text-text"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* Separador visual para indicar zona admin */}
        {isAdmin && (
          <div className="pt-2 pb-1">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted/60">
              Administração
            </p>
          </div>
        )}
      </nav>

      {/* Info do usuário logado e diagnóstico */}
      <div className="px-4 pb-2 space-y-2">
        <div className="px-4 py-2 rounded-xl bg-secondary/20 text-xs text-muted truncate">
          <p className="font-bold">Usuário:</p>
          <p className="truncate">{user?.email}</p>
          <p className="mt-1 font-bold">Status: <span className={roleColor}>{roleLabel}</span></p>
        </div>
      </div>

      <div className="p-4 border-t border-secondary">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
