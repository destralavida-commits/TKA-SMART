import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let parsedError = this.state.message;
      try {
        const obj = JSON.parse(this.state.message);
        if (obj && obj.error) {
          parsedError = `${obj.error} (Operasi: ${obj.operationType}, Path: ${obj.path || '-'})`;
        }
      } catch {
        // plain error string
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full neu-surface p-8 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl neu-well-rose flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1E1B4B]">
                  Terjadi Kendala Akses Data
                </h2>
                <p className="text-xs text-slate-500">
                  Sistem mendeteksi gangguan sinkronisasi sementara.
                </p>
              </div>
            </div>
            <div className="neu-inset p-4 text-sm text-slate-700 leading-relaxed break-words">
              {parsedError}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="neu-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
