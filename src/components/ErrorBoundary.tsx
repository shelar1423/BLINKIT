import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Keeps a crash inside one route from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging without ever showing a stack trace to the user.
    console.error('Route crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <div className="empty">
          <p>Something went wrong on this screen.</p>
          <button className="btn btn--dark" type="button" onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}>
            Back to home
          </button>
        </div>
      </main>
    );
  }
}
