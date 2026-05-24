"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePricesStore } from "@/stores/pricesStore";
import Icon from "@/components/shared/Icon";

const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/dashboard": {
    title: "Ciao, Gabriele",
    sub: "Ecco una panoramica del tuo patrimonio e dei conti.",
  },
  "/portfolio/azioni": { title: "Azioni", sub: "Le tue posizioni azionarie" },
  "/portfolio/etf": { title: "ETF", sub: "Fondi indicizzati ed ETF" },
  "/portfolio/crypto": {
    title: "Crypto",
    sub: "Criptovalute e asset digitali",
  },
  "/portfolio/dividendi": {
    title: "Dividendi",
    sub: "Titoli che pagano cedola",
  },
  "/portfolio/heatmap": { title: "Heatmap", sub: "Rendimenti per asset class" },
  "/portfolio/screener": { title: "Screener", sub: "Analisi e ricerca titoli" },
  "/finance/conti": { title: "Conti", sub: "Conti bancari, broker e wallet" },
  "/finance/movimenti": { title: "Movimenti", sub: "Tutte le transazioni" },
  "/finance/budget": {
    title: "Budget",
    sub: "Allocazione budget e pianificazione investimenti",
  },
  "/finance/patrimonio": {
    title: "Patrimonio",
    sub: "Attività, passività e composizione",
  },
  "/finance/obiettivi": { title: "Obiettivi", sub: "Risparmi e traguardi" },
  "/finance/ricorrenti": {
    title: "Ricorrenti",
    sub: "Addebiti automatici e abbonamenti",
  },
  "/finance/report": {
    title: "Report",
    sub: "Analisi delle finanze per periodo",
  },
  "/impostazioni": {
    title: "Impostazioni",
    sub: "Profilo, preferenze e account",
  },
};

export default function Topbar() {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { setSearchOpen, toggleSidebar } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();
  const { loading } = usePricesStore();

  const meta = PAGE_META[pathname] ?? { title: "LedgerNest", sub: "" };
  const isDark = settings.theme === "dark";

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
          aria-label={t("openSearch")}
        >
          <Icon name="search" size={14} />
          <span className="ledgernest-search-btn-text">
            Cerca un titolo, una transazione…
          </span>
          <kbd>⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="ledgernest-icon-btn" aria-label={t("notifications")}>
          <Icon name="bell" size={18} />
          <span className="ledgernest-dot" />
        </button>

        {/* Theme toggle */}
        <button
          className="ledgernest-icon-btn"
          onClick={toggleTheme}
          aria-label={t("toggleTheme")}
        >
          <Icon name={isDark ? "sun" : "moon"} size={18} />
        </button>

        {/* Refresh indicator */}
        {loading && (
          <button
            className="ledgernest-icon-btn"
            aria-label="Aggiornamento prezzi…"
            disabled
          >
            <Icon name="refresh" size={16} className="ledgernest-spinner" />
          </button>
        )}
      </div>
    </header>
  );
}
