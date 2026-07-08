import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[RootErrorBoundary] crash:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display:"grid", minHeight:"100vh", placeItems:"center", background:"#f8fafc", padding:"2rem" }}>
          <div style={{ background:"white", borderRadius:"1.5rem", padding:"2rem", boxShadow:"0 4px 32px #0001", maxWidth:"480px", textAlign:"center" }}>
            <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>⚠️</div>
            <h2 style={{ fontWeight:"700", marginBottom:"0.5rem", color:"#1e293b" }}>Terjadi kesalahan</h2>
            <p style={{ color:"#64748b", fontSize:"0.875rem", marginBottom:"1.5rem" }}>
              Aplikasi mengalami error. Cek Console (F12) untuk detail, lalu refresh halaman.
            </p>
            <pre style={{ textAlign:"left", background:"#f1f5f9", borderRadius:"0.75rem", padding:"1rem", fontSize:"0.7rem", color:"#dc2626", overflow:"auto", maxHeight:"200px", marginBottom:"1.5rem" }}>
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ background:"#7c3aed", color:"white", border:"none", borderRadius:"0.75rem", padding:"0.625rem 1.5rem", fontWeight:"600", cursor:"pointer", fontSize:"0.875rem" }}
            >
              Refresh Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
