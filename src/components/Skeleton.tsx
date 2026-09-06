import { cn } from '../lib/utils';

// Bloco de carregamento reutilizável — usar no lugar de "piscar" a tela ou
// mostrar um empty state falso enquanto os dados ainda não chegaram do
// Firestore (onSnapshot é assíncrono, o primeiro render sempre vem vazio).
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-100 rounded-lg", className)} />;
}
