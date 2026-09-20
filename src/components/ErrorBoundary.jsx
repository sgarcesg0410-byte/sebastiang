import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  handleResetAndReload = () => {
    try {
      sessionStorage.clear();
      // Limpiar claves temporales si hubo corrupción
      localStorage.removeItem('sebastian_g_deleted_catalog_ids_v2');
      localStorage.removeItem('sebastian_g_samples_purged_v1');
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-2">
                Sebastian G
              </h2>
              <p className="text-sm text-stone-400">
                Se presentó un problema al cargar la vista. Puedes reiniciar la aplicación con el botón a continuación.
              </p>
            </div>

            <button
              onClick={this.handleResetAndReload}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restablecer y Recargar</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
