import { Plus, LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

// Estado vazio padrão do sistema — usado quando uma lista/tela não tem nada
// pra mostrar ainda, sempre com uma explicação clara e, quando fizer
// sentido, uma ação direta pra resolver isso (ex: "+ Novo Agendamento").
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      <div className="w-14 h-14 rounded-2xl bg-pink-50 text-primary flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary px-6 py-2.5 text-xs">
          <Plus className="w-4 h-4" /> {actionLabel}
        </button>
      )}
    </div>
  );
}
