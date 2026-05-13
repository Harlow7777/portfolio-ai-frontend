import { useEffect, useState } from "react";

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBroker, setSelectedBroker] = useState("robinhood");

  const API_BASE = "http://127.0.0.1:8000/api";

  const brokerOptions = [
    {
      id: "alpaca",
      label: "Alpaca",
    },
    {
      id: "robinhood",
      label: "Robinhood",
    },
  ];

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          analyticsRes,
          performanceRes,
          recommendationsRes,
          holdingsRes,
          newsRes,
        ] = await Promise.all([
          fetch(`${API_BASE}/analytics`),
          fetch(`${API_BASE}/performance`),
          fetch(`${API_BASE}/recommendations`),
          fetch(`${API_BASE}/portfolio/${selectedBroker}`),
          fetch(`${API_BASE}/news/NVDA`),
        ]);

        const analytics = await analyticsRes.json();
        const performance = await performanceRes.json();
        const recommendationData = await recommendationsRes.json();
        const holdingsData = await holdingsRes.json();
        const newsData = await newsRes.json();

        setPortfolio({
          totalValue: `$${analytics.current_value?.toLocaleString() || 0}`,
          dailyChange: `${analytics.total_return_percent || 0}%`,
          alpha: `${performance.alpha_percent || 0}%`,
          benchmark: performance.benchmark_symbol || "SPY",
          benchmarkReturn: `${performance.benchmark_return_percent || 0}%`,
        });

        setRecommendations(
          recommendationData
        );

        setHoldings(
          holdingsData.positions || []
        );

        setNews(newsData || []);
      } catch (error) {
        console.error(
          "Dashboard load failed:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [selectedBroker]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-2xl font-semibold">
        Loading Portfolio Dashboard...
      </div>
    );
  }

  if (!portfolio || !recommendations) {
    return (
      <div className="min-h-screen bg-slate-950 text-red-400 flex items-center justify-center text-2xl font-semibold">
        Failed to load dashboard data.
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
            Portfolio Intelligence Dashboard
          </h1>
          <p className="text-slate-400 mt-2">
            AI-powered portfolio analytics and market intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <span className="text-slate-400 text-sm uppercase tracking-wide">
              Broker
            </span>

            <select
              value={selectedBroker}
              onChange={(e) =>
                setSelectedBroker(e.target.value)
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none"
            >
              {brokerOptions.map((broker) => (
                <option
                  key={broker.id}
                  value={broker.id}
                >
                  {broker.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Portfolio Value"
            value={portfolio.totalValue}
            subtitle="Current valuation"
          />

          <StatCard
            title="Daily Change"
            value={portfolio.dailyChange}
            subtitle="24 hour performance"
          />

          <StatCard
            title="Alpha"
            value={portfolio.alpha}
            subtitle="Relative performance"
          />

          <StatCard
            title="Benchmark"
            value={portfolio.benchmarkReturn}
            subtitle={`vs ${portfolio.benchmark}`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">
                Portfolio Holdings
              </h2>

              <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition">
                Refresh
              </button>
            </div>

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
                    <tr
                      key={index}
                      className="border-b border-slate-900 hover:bg-slate-800/40 transition"
                    >
                      <td className="py-4 font-medium">
                        {holding.symbol}
                      </td>

                      <td className="py-4">
                        {holding.qty || holding.shares || "-"}
                      </td>

                      <td className="py-4">
                        ${Number(
                          holding.market_value || 0
                        ).toLocaleString()}
                      </td>

                      <td
                        className={`py-4 font-semibold ${
                          Number(
                            holding.unrealized_plpc || 0
                          ) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {(
                          Number(
                            holding.unrealized_plpc || 0
                          ) * 100
                        ).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4">
              AI Insights
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
                  Summary
                </h3>

                <p className="text-slate-200 leading-relaxed">
                  {recommendations.summary}
                </p>
              </div>

              <InsightSection
                title="Strengths"
                items={recommendations.strengths}
              />

              <InsightSection
                title="Risks"
                items={recommendations.risks}
              />

              <InsightSection
                title="Recommendations"
                items={recommendations.recommendations}
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">
              Market News & Sentiment
            </h2>

            <span className="text-sm text-slate-400">
              Real-time market context
            </span>
          </div>

          <div className="space-y-4">
            {news.map((item, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-800/40 rounded-2xl p-4 border border-slate-800"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-lg">
                      {item.symbol}
                    </span>

                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.sentiment >= 0
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {item.sentiment >= 0
                        ? "Bullish"
                        : "Bearish"}
                    </span>
                  </div>

                  <p className="text-slate-300">
                    {item.headline}
                  </p>
                </div>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition whitespace-nowrap"
                >
                  View Article
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
      <div className="text-slate-400 text-sm mb-3">
        {title}
      </div>

      <div className="text-3xl font-bold mb-2">
        {value}
      </div>

      <div className="text-slate-500 text-sm">
        {subtitle}
      </div>
    </div>
  );
}

function InsightSection({ title, items }) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
        {title}
      </h3>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className="bg-slate-800/50 rounded-xl px-3 py-2 text-slate-200"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
