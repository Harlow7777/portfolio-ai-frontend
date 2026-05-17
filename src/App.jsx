import { useEffect, useRef, useState } from "react";

// ── Broker auth config ─────────────────────────────────────────────────────────
const BROKER_CONFIG = {
  robinhood: {
    label: "Robinhood",
    fields: [
      { key: "username", label: "Email / Username", type: "email", placeholder: "you@example.com" },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••" },
    ],
    mfa: true,
  },
  alpaca: {
    label: "Alpaca",
    fields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "PK..." },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "••••••••" },
    ],
    paperToggle: true,
  },
};

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function BrokerAuthModal({ broker, onSuccess, onCancel, apiBase }) {
  const config = BROKER_CONFIG[broker];
  const [fields, setFields] = useState({});
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [paper, setPaper] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const body =
        broker === "robinhood"
          ? { ...fields, mfa_code: mfaRequired ? mfaCode : undefined }
          : { ...fields, paper };

      const res = await fetch(`${apiBase}/auth/${broker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 202 && data.detail === "mfa_required") {
        setMfaRequired(true);
        setError("MFA code required — check your authenticator app.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.detail || "Authentication failed.");
        setLoading(false);
        return;
      }

      onSuccess(data);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white">
            Connect {config.label}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Your credentials are sent directly to your broker and never stored.
          </p>
        </div>

        <div className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-slate-400 mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={fields[field.key] || ""}
                onChange={(e) => setFields((f) => ({ ...f, [field.key]: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-slate-500 focus:border-slate-500 transition"
              />
            </div>
          ))}

          {/* MFA field — shown after first attempt triggers it */}
          {mfaRequired && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">MFA / 2FA Code</label>
              <input
                type="text"
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full bg-slate-800 border border-yellow-600 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-slate-500 focus:border-yellow-500 transition"
              />
            </div>
          )}

          {/* Paper trading toggle for Alpaca */}
          {config.paperToggle && (
            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-300">Paper trading account</span>
              <button
                onClick={() => setPaper((p) => !p)}
                className={`w-11 h-6 rounded-full transition-colors relative ${paper ? "bg-green-600" : "bg-slate-600"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${paper ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          )}

          {error && (
            <p className={`text-sm px-3 py-2 rounded-xl ${
              mfaRequired ? "bg-yellow-500/10 text-yellow-300 border border-yellow-700" : "bg-red-500/10 text-red-300 border border-red-700"
            }`}>
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition text-slate-300 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 transition text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            {loading ? "Connecting..." : `Connect ${config.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [news, setNews] = useState([]);
  const [newsPage, setNewsPage] = useState(1);
  const [newsSymbolFilter, setNewsSymbolFilter] = useState("All");
  const NEWS_PER_PAGE = 5;
  const [selectedBroker, setSelectedBroker] = useState("robinhood");

  // Auth modal state
  const [pendingBroker, setPendingBroker] = useState(null);
  const [authenticatedBrokers, setAuthenticatedBrokers] = useState(new Set());

  // Per-section loading states
  const [loadingSync, setLoadingSync] = useState(true);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "I've analyzed your portfolio. Ask me anything about your holdings, performance, or market conditions.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  const API_BASE = "http://127.0.0.1:8000/api";

  const brokerOptions = Object.entries(BROKER_CONFIG).map(([id, cfg]) => ({
    id,
    label: cfg.label,
  }));

  const resetLoadingStates = () => {
    setLoadingSync(true);
    setLoadingHoldings(true);
    setLoadingStats(true);
    setLoadingRecommendations(true);
    setLoadingNews(true);
  };

  const fetchNewsForPortfolio = async (positions) => {
    setLoadingNews(true);
    try {
      const newsData = {};
      for (const position of positions) {
        await fetch(`${API_BASE}/news/ingest/${position.symbol}`, { method: "POST" });
        const res = await fetch(`${API_BASE}/news/${position.symbol}`);
        const data = await res.json();
        newsData[position.symbol] = data.map((article) => ({
          ...article,
          symbol: position.symbol,
        }));
      }
      setNews(Object.values(newsData).flat());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNews(false);
    }
  };

  const runDashboardLoad = async (broker) => {
    resetLoadingStates();
    setPortfolio(null);
    setHoldings([]);
    setRecommendations(null);
    setNews([]);

    try {
      await fetch(`${API_BASE}/sync/${broker}`, { method: "POST" });
    } catch (err) {
      console.warn("Sync failed:", err);
    } finally {
      setLoadingSync(false);
    }

    let positions = [];
    try {
      const holdingsRes = await fetch(`${API_BASE}/portfolio/${broker}`);
      const holdingsData = await holdingsRes.json();
      positions = holdingsData.positions || [];
      setHoldings(positions);
    } catch (err) {
      console.error("Holdings load failed:", err);
    } finally {
      setLoadingHoldings(false);
    }

    try {
      const [analyticsRes, performanceRes, recommendationsRes] = await Promise.all([
        fetch(`${API_BASE}/analytics?broker=${broker}`),
        fetch(`${API_BASE}/performance?broker=${broker}`),
        fetch(`${API_BASE}/recommendations?broker=${broker}`),
      ]);

      const analytics = await analyticsRes.json();
      const performance = await performanceRes.json();
      const recommendationData = await recommendationsRes.json();

      setPortfolio({
        totalValue: `$${analytics.current_value?.toLocaleString() || 0}`,
        dailyChange: `${analytics.total_return_percent || 0}%`,
        alpha: `${performance.alpha_percent || 0}%`,
        benchmark: performance.benchmark_symbol || "SPY",
        benchmarkReturn: `${performance.benchmark_return_percent || 0}%`,
      });
      setLoadingStats(false);

      setRecommendations(recommendationData);
      setLoadingRecommendations(false);
    } catch (err) {
      console.error("Stats load failed:", err);
      setLoadingStats(false);
      setLoadingRecommendations(false);
    }

    await fetchNewsForPortfolio(positions);
  };

  // When broker changes, show auth modal if not yet authenticated
  const handleBrokerChange = (broker) => {
    if (authenticatedBrokers.has(broker)) {
      setSelectedBroker(broker);
    } else {
      setPendingBroker(broker);
    }
  };

  const handleAuthSuccess = (data) => {
    const broker = data.broker;
    setAuthenticatedBrokers((prev) => new Set([...prev, broker]));
    setPendingBroker(null);
    setSelectedBroker(broker);
  };

  const handleAuthCancel = () => {
    setPendingBroker(null);
  };

  useEffect(() => {
    if (!selectedBroker) return;
    runDashboardLoad(selectedBroker);
  }, [selectedBroker]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMessage = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat?broker=${selectedBroker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: chatMessages }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the analysis service. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const newsSymbols = ["All", ...Array.from(new Set(news.map((n) => n.symbol)))];
  const filteredNews =
    newsSymbolFilter === "All" ? news : news.filter((n) => n.symbol === newsSymbolFilter);
  const totalNewsPages = Math.max(1, Math.ceil(filteredNews.length / NEWS_PER_PAGE));
  const paginatedNews = filteredNews.slice(
    (newsPage - 1) * NEWS_PER_PAGE,
    newsPage * NEWS_PER_PAGE
  );

  return (
    <>
      {/* Auth modal — rendered outside the dashboard flow */}
      {pendingBroker && (
        <BrokerAuthModal
          broker={pendingBroker}
          apiBase={API_BASE}
          onSuccess={handleAuthSuccess}
          onCancel={handleAuthCancel}
        />
      )}

      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Portfolio Intelligence Dashboard</h1>
              <p className="text-slate-400 mt-2">AI-powered portfolio analytics and market intelligence.</p>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
              {loadingSync && (
                <span className="text-slate-500 text-xs flex items-center gap-1">
                  <Spinner size="sm" /> Syncing...
                </span>
              )}
              <span className="text-slate-400 text-sm uppercase tracking-wide">Broker</span>
              <div className="flex gap-2">
                {brokerOptions.map((broker) => (
                  <button
                    key={broker.id}
                    onClick={() => handleBrokerChange(broker.id)}
                    className={`px-4 py-2 rounded-xl text-sm transition flex items-center gap-2 ${
                      selectedBroker === broker.id
                        ? "bg-slate-600 text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {authenticatedBrokers.has(broker.id) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    )}
                    {broker.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {loadingStats ? (
              [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard title="Portfolio Value" value={portfolio?.totalValue ?? "—"} subtitle="Current valuation" />
                <StatCard title="Daily Change" value={portfolio?.dailyChange ?? "—"} subtitle="24 hour performance" />
                <StatCard title="Alpha" value={portfolio?.alpha ?? "—"} subtitle="Relative performance" />
                <StatCard title="Benchmark" value={portfolio?.benchmarkReturn ?? "—"} subtitle={`vs ${portfolio?.benchmark ?? "SPY"}`} />
              </>
            )}
          </div>

          {/* Holdings + AI Insights */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Portfolio Holdings</h2>
                {loadingHoldings && <Spinner />}
              </div>
              {loadingHoldings ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-sm">
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3">Shares</th>
                        <th className="pb-3">Value</th>
                        <th className="pb-3">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding, index) => (
                        <tr key={index} className="border-b border-slate-900 hover:bg-slate-800/40 transition">
                          <td className="py-4 font-medium">{holding.symbol}</td>
                          <td className="py-4">
                            {Number(holding.qty || holding.shares || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 4,
                            }) || "-"}
                          </td>
                          <td className="py-4">${Number(holding.market_value || 0).toLocaleString()}</td>
                          <td className={`py-4 font-semibold ${Number(holding.unrealized_plpc || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {(Number(holding.unrealized_plpc || 0) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">AI Insights</h2>
                {loadingRecommendations && <Spinner />}
              </div>
              {loadingRecommendations ? (
                <div className="space-y-4">
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-1/3" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-3 bg-slate-800 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
                    ))}
                  </div>
                  {[...Array(3)].map((_, s) => (
                    <div key={s} className="space-y-2 mt-2">
                      <div className="h-4 bg-slate-800 rounded animate-pulse w-1/4" />
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-3 bg-slate-800 rounded animate-pulse" style={{ width: `${85 - i * 8}%` }} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">Summary</h3>
                    <p className="text-slate-200 leading-relaxed">{recommendations?.summary}</p>
                  </div>
                  <InsightSection title="Strengths" items={recommendations?.strengths} />
                  <InsightSection title="Risks" items={recommendations?.risks} />
                  <InsightSection title="Recommendations" items={recommendations?.recommendations} />
                </div>
              )}
            </div>
          </div>

          {/* AI Chat */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-semibold">Ask Your Portfolio AI</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Follow-up questions about your holdings, risk, or market conditions. Press Enter to send.
                </p>
              </div>
              <button
                onClick={() => setChatMessages([{
                  role: "assistant",
                  content: "I've analyzed your portfolio. Ask me anything about your holdings, performance, or market conditions.",
                }])}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition text-sm text-slate-300"
              >
                Clear chat
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6 overflow-y-auto max-h-[420px]">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="p-4 border-t border-slate-800 flex gap-3 items-end">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Ask about your portfolio... (Enter to send, Shift+Enter for new line)"
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none placeholder-slate-500 focus:border-slate-500 transition"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="px-5 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 transition text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Send
              </button>
            </div>
          </div>

          {/* News */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">Market News & Sentiment</h2>
                {loadingNews && <Spinner />}
              </div>
              {!loadingNews && (
                <div className="flex items-center gap-2 flex-wrap">
                  {newsSymbols.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => { setNewsSymbolFilter(sym); setNewsPage(1); }}
                      className={`px-3 py-1 rounded-xl text-sm transition ${
                        newsSymbolFilter === sym
                          ? "bg-slate-600 text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingNews ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedNews.length === 0 ? (
                    <p className="text-slate-400 text-sm">No news for this symbol.</p>
                  ) : (
                    paginatedNews.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-800/40 rounded-2xl p-4 border border-slate-800">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold text-lg">{item.symbol}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${item.sentiment >= 0 ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                              {item.sentiment >= 0 ? "Bullish" : "Bearish"}
                            </span>
                          </div>
                          <p className="text-slate-300">{item.headline}</p>
                        </div>
                        <a href={item.url} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition whitespace-nowrap">
                          View Article
                        </a>
                      </div>
                    ))
                  )}
                </div>

                {totalNewsPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                    <span className="text-slate-400 text-sm">
                      Page {newsPage} of {totalNewsPages} · {filteredNews.length} articles
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setNewsPage((p) => Math.max(1, p - 1))} disabled={newsPage === 1} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                      <button onClick={() => setNewsPage((p) => Math.min(totalNewsPages, p + 1))} disabled={newsPage === totalNewsPages} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ── Shared components ──────────────────────────────────────────────────────────

function Spinner({ size = "md" }) {
  const dim = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  return (
    <svg className={`${dim} animate-spin text-slate-400`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-3">
      <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
      <div className="h-8 bg-slate-800 rounded animate-pulse w-2/3" />
      <div className="h-3 bg-slate-800 rounded animate-pulse w-1/3" />
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
      <div className="text-slate-400 text-sm mb-3">{title}</div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className="text-slate-500 text-sm">{subtitle}</div>
    </div>
  );
}

function InsightSection({ title, items = [] }) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-slate-200 text-sm leading-relaxed">{item}</li>
        ))}
      </ul>
    </div>
  );
}