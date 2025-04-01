import React from 'react';

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Noe gikk galt</h2>
          <p>Det oppstod en feil i applikasjonen. Prøv å laste siden på nytt.</p>
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary>Teknisk informasjon</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              border: 'none',
              backgroundColor: '#3f51b5',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Last siden på nytt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
