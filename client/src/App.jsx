import { useState, useEffect, useRef } from "react";

const API = "http://localhost:3001";

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [rfsId, setRfsId] = useState("EANY-ETKBUIDF");
  const [itemCount, setItemCount] = useState(null);
  const logsEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function connectSSE() {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`${API}/api/logs`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "log") {
        setLogs((prev) => [
          ...prev,
          { message: data.message, logType: data.logType },
        ]);
      } else if (data.type === "done") {
        setReport(data.report);
        setIsRunning(false);
        es.close();
      } else if (data.type === "error") {
        setError(data.message);
        setIsRunning(false);
        es.close();
      }
    };
    eventSourceRef.current = es;
  }

  async function handleRun() {
    if (!rfsId.trim()) {
      setError("Please enter an RFS ID");
      return;
    }
    setIsRunning(true);
    setLogs([]);
    setReport(null);
    setError(null);
    setItemCount(null);
    connectSSE();
    await fetch(`${API}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfsId: rfsId.trim() }),
    });
  }

  function logColor(type) {
    switch (type) {
      case "success":
        return "#15803d";
      case "error":
        return "#b91c1c";
      case "warning":
        return "#b45309";
      case "start":
        return "#185FA5";
      default:
        return "#6b7280";
    }
  }

  const added = report?.added?.length ?? 0;
  const skipped = report?.skipped?.length ?? 0;
  const total = added + skipped;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#f8fafc",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          padding: "2rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "#185FA5",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
              eany
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>RFS Automation</div>
          </div>
        </div>

        {/* Request details */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#94a3b8",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Request details
          </div>
          {[
            { label: "Store", value: "Ukmergės g." },
            { label: "Supplier", value: "Senukai.lt" },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                {value}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 0",
            }}
          >
            <span style={{ fontSize: 13, color: "#64748b" }}>Status</span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 99,
                background: isRunning
                  ? "#fef9c3"
                  : report
                    ? "#dcfce7"
                    : "#eff6ff",
                color: isRunning ? "#854d0e" : report ? "#15803d" : "#185FA5",
                fontWeight: 500,
              }}
            >
              {isRunning ? "Running" : report ? "Complete" : "Ready"}
            </span>
          </div>
        </div>

        {/* RFS ID input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>RFS ID</label>
          <input
            type="text"
            value={rfsId}
            onChange={(e) => setRfsId(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. EANY-ETKBUIDF"
            style={{
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: isRunning ? "#f8fafc" : "#ffffff",
              color: "#0f172a",
              outline: "none",
              fontFamily: "monospace",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Run button */}
        <div style={{ marginTop: "auto" }}>
          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "none",
              background: isRunning ? "#cbd5e1" : "#185FA5",
              color: isRunning ? "#94a3b8" : "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: isRunning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isRunning ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run automation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Header */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
            Cart automation
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Fills the Senukai cart from OMS supplier requests. Review and
            complete the order manually.
          </div>
        </div>

        {/* Stats row — only shown after run */}
        {report && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {[
              { label: "Items processed", value: total },
              { label: "Added to cart", value: added },
              { label: "Skipped", value: skipped },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{ fontSize: 22, fontWeight: 600, color: "#0f172a" }}
                >
                  {value}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live log */}
        {(logs.length > 0 || isRunning) && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "1rem 1.25rem",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isRunning && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
              )}
              Live log
            </div>
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {logs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: logColor(log.logType),
                    lineHeight: 1.8,
                  }}
                >
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {report && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            {/* Added */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "1rem 1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#15803d",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Added to cart ({added})
              </div>
              {added === 0 && (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  Nothing added.
                </div>
              )}
              {report.added.map((item, i) => (
                <div
                  key={i}
                  style={{
                    paddingTop: 10,
                    paddingBottom: 10,
                    borderBottom:
                      i < report.added.length - 1
                        ? "1px solid #f1f5f9"
                        : "none",
                  }}
                >
                  <div
                    style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      fontFamily: "monospace",
                      marginTop: 2,
                    }}
                  >
                    {item.ean}
                  </div>
                  <div style={{ fontSize: 12, color: "#185FA5", marginTop: 4 }}>
                    Qty: {item.added}
                    {item.capped && (
                      <span style={{ color: "#b45309", marginLeft: 8 }}>
                        capped from {item.needed}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Skipped */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "1rem 1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Skipped ({skipped})
              </div>
              {skipped === 0 && (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  Nothing skipped.
                </div>
              )}
              {report.skipped.map((item, i) => (
                <div
                  key={i}
                  style={{
                    paddingTop: 10,
                    paddingBottom: 10,
                    borderBottom:
                      i < report.skipped.length - 1
                        ? "1px solid #f1f5f9"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      fontFamily: "monospace",
                    }}
                  >
                    {item.ean}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart prompt */}
        {report && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "#185FA5",
            }}
          >
            Cart is open in your browser — review and complete the order
            manually.
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
