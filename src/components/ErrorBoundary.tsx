import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/20 p-4">
          <div className="glass-card p-8 max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center bg-red-50 p-4 rounded-3xl shadow-sm">
              <AlertTriangle className="text-red-500 w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-text">Ops! Algo deu errado.</h2>
            <p className="text-muted font-medium">
              Ocorreu um erro inesperado no sistema. Por favor, tente recarregar a página.
            </p>
            <div className="p-4 bg-red-50 rounded-xl text-left overflow-hidden">
              <p className="text-xs font-mono text-red-600 break-all">
                {this.state.error?.message}
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full btn-primary py-4 text-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <RefreshCw className="w-5 h-5" />
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
