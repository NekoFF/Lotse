import { Bubble, Calendar, ChevronLeft, Info } from "./icons";

export type Tab = "anliegen" | "termine" | "info";

export function NavBar({ title, backLabel, onBack }: { title?: string; backLabel?: string; onBack?: () => void }) {
  return (
    <header className="navbar glass">
      <div className="navbar-in">
        {onBack ? (
          <button className="back" onClick={onBack} aria-label={`Zurück zu ${backLabel ?? ""}`}>
            <ChevronLeft />
            <span>{backLabel}</span>
          </button>
        ) : (
          <span />
        )}
        <div className="navbar-title">{title}</div>
        <span />
      </div>
    </header>
  );
}

const TABS: { id: Tab; label: string; Icon: typeof Bubble }[] = [
  { id: "anliegen", label: "Anliegen", Icon: Bubble },
  { id: "termine", label: "Termine", Icon: Calendar },
  { id: "info", label: "Info", Icon: Info },
];

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar glass" aria-label="Hauptnavigation">
      <div className="tabbar-in">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className="tab" aria-current={tab === id ? "page" : undefined} onClick={() => onTab(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
