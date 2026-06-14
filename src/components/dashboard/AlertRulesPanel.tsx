import { useApp, ROLE_META, type Role, type IncidentType, type RuleLevel } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

const TYPES: { key: IncidentType; label: string; icon: string }[] = [
  { key: "medical", label: "Medical", icon: "✚" },
  { key: "fire", label: "Fire", icon: "🔥" },
  { key: "intrusion", label: "Intrusion", icon: "⚠" },
  { key: "crowd", label: "Crowd", icon: "👥" },
];

const LEVELS: { v: RuleLevel; color: string }[] = [
  { v: "P1", color: "destructive" },
  { v: "P2", color: "warning" },
  { v: "P3", color: "info" },
  { v: "off", color: "muted" },
];

export function AlertRulesPanel() {
  const { alertRules, setRule, resetRules, session } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!session.role) return null;
  const isMaster = session.role === "station-master";
  // Non-master roles can only tune their own row.
  const editableRoles: Role[] = isMaster
    ? (Object.keys(ROLE_META) as Role[])
    : [session.role];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Alert rules"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <span>⚙</span>
        <span className="hidden md:inline">Rules</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(94vw,540px)] panel z-50 max-h-[75vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Alert Routing Rules</div>
              <div className="text-[10px] text-muted-foreground">
                Tune the priority each role receives per incident type.
              </div>
            </div>
            <button
              onClick={resetRules}
              className="text-[10px] uppercase tracking-wider text-primary hover:underline shrink-0"
            >
              Reset defaults
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {editableRoles.map((r) => {
              const m = ROLE_META[r];
              return (
                <div key={r} className="panel bg-card/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
                      style={{ background: `var(--color-${m.color})20`, color: `var(--color-${m.color})` }}
                    >
                      {m.emoji}
                    </span>
                    <div className="text-sm font-semibold">{m.label}</div>
                  </div>
                  <div className="space-y-1.5">
                    {TYPES.map((t) => {
                      const current = alertRules[r][t.key];
                      return (
                        <div key={t.key} className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-[110px] text-xs">
                            <span>{t.icon}</span>
                            <span className="truncate">{t.label}</span>
                          </div>
                          <div className="flex gap-1 flex-wrap flex-1 justify-end">
                            {LEVELS.map((l) => {
                              const sel = current === l.v;
                              return (
                                <button
                                  key={l.v}
                                  onClick={() => setRule(r, t.key, l.v)}
                                  className="text-[10px] font-bold px-2.5 py-1 rounded border transition-colors"
                                  style={{
                                    borderColor: sel ? `var(--color-${l.color})` : "var(--color-border)",
                                    background: sel ? `var(--color-${l.color})25` : "transparent",
                                    color: sel ? `var(--color-${l.color})` : "var(--color-muted-foreground)",
                                  }}
                                >
                                  {l.v.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
            P1 = critical · P2 = standard · P3 = info · OFF = mute.
            {!isMaster && " Only your own routing is editable."}
          </div>
        </div>
      )}
    </div>
  );
}
