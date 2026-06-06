"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePricesStore } from "@/stores/pricesStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { useNotificationsStore } from "@/stores/notificationsStore";
import Icon from "@/components/shared/Icon";

function timeAgo(iso: string, justNow: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return justNow
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function Topbar() {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const tb = useTranslations("topbar");
  const tn = useTranslations("nav");
  const tw = useTranslations("watchlist");
  const { setSearchOpen, toggleSidebar } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();
  const { loading } = usePricesStore();
  const { alerts } = useWatchlistStore();
  const { dismissedIds, dismiss, dismissAll } = useNotificationsStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const triggered = alerts.filter((a) => !a.active && a.triggeredAt);
  const visible   = triggered.filter((a) => !dismissedIds.includes(a.id));

  useEffect(() => {
    if (!notifOpen) return;
    const fn = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [notifOpen]);

  const isDark = settings.theme === "dark";

  const PAGE_META: Record<string, { title: string; sub: string }> = {
    "/dashboard":              { title: tb("welcome"),       sub: tb("welcomeSub") },
    "/portfolio/stocks":       { title: tn("azioni"),        sub: tb("subAzioni") },
    "/portfolio/etf":          { title: tn("etf"),           sub: tb("subEtf") },
    "/portfolio/crypto":       { title: tn("crypto"),        sub: tb("subCrypto") },
    "/portfolio/dividends":    { title: tn("dividendi"),     sub: tb("subDividendi") },
    "/portfolio/commodity":    { title: tn("commodity"),     sub: tb("subCommodity") },
    "/portfolio/heatmap":      { title: tn("heatmap"),       sub: tb("subHeatmap") },
    "/portfolio/watchlist":    { title: tn("screener"),      sub: tb("subWatchlist") },
    "/finance/accounts":       { title: tn("conti"),         sub: tb("subConti") },
    "/finance/transactions":   { title: tn("movimenti"),     sub: tb("subMovimenti") },
    "/finance/budget":         { title: tn("budget"),        sub: tb("subBudget") },
    "/finance/net-worth":      { title: tn("patrimonio"),    sub: tb("subPatrimonio") },
    "/finance/goals":          { title: tn("obiettivi"),     sub: tb("subObiettivi") },
    "/finance/recurring":      { title: tn("ricorrenti"),    sub: tb("subRicorrenti") },
    "/finance/report":         { title: tn("report"),        sub: tb("subReport") },
    "/finance/shared":         { title: tn("condivisione"),  sub: tb("subCondivisione") },
    "/settings":               { title: tn("impostazioni"),  sub: tb("subImpostazioni") },
  };

  const tickerMatch = pathname.match(/^\/ticker\/(.+)$/)
  const meta = PAGE_META[pathname]
    ?? (tickerMatch
      ? { title: decodeURIComponent(tickerMatch[1]).toUpperCase(), sub: tb('subTicker') }
      : { title: "LedgerNest", sub: "" })

  function toggleTheme() {
    updateSettings({ theme: isDark ? "light" : "dark" });
  }

  return (
    <header className="ledgernest-top">
      <button
        className="ledgernest-hamburger"
        onClick={toggleSidebar}
        aria-label="Menu"
      >
        <span /><span /><span />
      </button>
      <div className="ledgernest-top-titles">
        <h1 className="ledgernest-page-title">{meta.title}</h1>
        {meta.sub && <div className="ledgernest-page-sub">{meta.sub}</div>}
      </div>

      <div className="ledgernest-top-right">
        {/* Search */}
        <button
          className="ledgernest-search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label={tc("openSearch")}
        >
          <Icon name="search" size={14} />
          <span className="ledgernest-search-btn-text">
            {tb("searchPlaceholder")}
          </span>
          <kbd>⌘K</kbd>
        </button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            className="ledgernest-icon-btn"
            aria-label={tc("notifications")}
            onClick={() => setNotifOpen((o) => !o)}
            style={{ position: "relative" }}
          >
            <Icon name="bell" size={18} />
            {visible.length > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                minWidth: 16, height: 16, borderRadius: 8, padding: "0 3px",
                background: "var(--danger)", color: "#fff",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1, boxSizing: "border-box",
              }}>
                {visible.length > 9 ? "9+" : visible.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              width: 290, maxHeight: 380, overflowY: "auto",
              background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
              borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 300,
            }}>
              <div style={{
                padding: "12px 14px 10px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid var(--border-default)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tc("notifications")}</div>
                {visible.length > 0 && (
                  <button
                    onClick={() => { dismissAll(visible.map((a) => a.id)); setNotifOpen(false); }}
                    style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {tb("notifClearAll")}
                  </button>
                )}
              </div>

              {visible.length === 0 ? (
                <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
                  {tb("notifEmpty")}
                </div>
              ) : visible.map((a) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px", borderBottom: "1px solid var(--border-default)",
                }}>
                  <div style={{
                    flex: "0 0 30px", height: 30, borderRadius: 8,
                    background: "var(--bg-base)",
                    color: a.direction === "above" ? "var(--success)" : "var(--danger)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, flexShrink: 0,
                  }}>
                    {a.direction === "above" ? "↑" : "↓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{a.ticker}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {a.direction === "above" ? tw("above") : tw("below")} {a.threshold.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
                      {a.triggeredAt ? timeAgo(a.triggeredAt, tb("notifJustNow")) : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(a.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2, fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="ledgernest-icon-btn"
          onClick={toggleTheme}
          aria-label={tc("toggleTheme")}
        >
          <Icon name={isDark ? "sun" : "moon"} size={18} />
        </button>

        {/* Refresh indicator */}
        {loading && (
          <button
            className="ledgernest-icon-btn"
            aria-label={tb("updatingPrices")}
            disabled
          >
            <Icon name="refresh" size={16} className="ledgernest-spinner" />
          </button>
        )}
      </div>
    </header>
  );
}
