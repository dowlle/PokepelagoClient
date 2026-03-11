import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="flex h-screen items-center justify-center bg-gray-950 text-white p-8">
                    <div className="flex flex-col items-center gap-6 max-w-md text-center">
                        <div className="text-5xl">💥</div>
                        <div>
                            <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
                            <p className="text-gray-400 text-sm mb-4">
                                An unexpected error occurred. Your saved profiles and settings are safe —
                                reloading the page will restore them.
                            </p>
                            <pre className="text-left text-[10px] text-red-300 bg-gray-900 border border-gray-800 rounded p-3 overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                Reload Page
                            </button>
                            <button
                                onClick={() => this.setState({ error: null })}
                                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold transition-colors border border-gray-700"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
