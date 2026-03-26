import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-3 p-8"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="text-lg font-semibold" style={{ color: '#ca2c2c' }}>
            Something went wrong
          </div>
          <div className="text-sm text-center max-w-md">
            {this.props.fallbackMessage || this.state.error}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer mt-2"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
