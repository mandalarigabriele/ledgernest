"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePricesStore } from "@/stores/pricesStore";
import Icon from "@/components/shared/Icon";

export default function Topbar() {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const tb = useTranslations("topbar");
  const tn = useTranslations("nav");
  const { setSearchOpen, toggleSidebar } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();
  const { loading } = usePricesStore();

  const isDark = settings.theme === "dark";

  const PAGE_META: Record<string, { title: string; sub: string }> = {
    "/dashboard":              { title: tb("welcome"),       sub: tb("welcomeSub") },
    "/portfolio/stocks":       { title: tn("azioni"),        sub: tb("subAzioni") },
    "/portfolio/etf":          { title: tn("etf"),           sub: tb("subEtf") },
    "/portfolio/crypto":       { title: tn("crypto"),        sub: tb("subCrypto") },
    "/portfolio/dividends":    { title: tn("dividendi"),     sub: tb("subDividendi") },
    "/portfolio/heatmap":      { title: tn("heatmap"),       sub: tb("subHeatmap") },
    "/portfolio/screener":     { title: tn("screener"),      sub: tb("subScreener") },
    "/finance/accounts":       { title: tn("conti"),         sub: tb("subConti") },
    "/finance/transactions":   { title: tn("movimenti"),     sub: tb("subMovimenti") },
    "/finance/budget":         { title: tn("budget"),        sub: tb("subBudget") },
    "/finance/net-worth":      { title: tn("patrimonio"),    sub: tb("subPatrimonio") },
    "/finance/goals":          { title: tn("obiettivi"),     sub: tb("subObiettivi") },
    "/finance/recurring":      { title: tn("ricorrenti"),    sub: tb("subRicorrenti") },
    "/finance/report":         { title: tn("report"),        sub: tb("subReport") },
    "/settings":               { title: tn("impostazioni"),  sub: tb("subImpostazioni") },
  };

  const meta = PAGE_META[pathname] ?? { title: "LedgerNest", sub: "" };

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
        <button className="ledgernest-icon-btn" aria-label={tc("notifications")}>
          <Icon name="bell" size={18} />
          <span className="ledgernest-dot" />
        </button>

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
