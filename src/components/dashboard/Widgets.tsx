import { useApp } from "@/lib/store";
import { STAFF_MATRIX } from "@/lib/ndls-data";
import { useState } from "react";

function safetyScore(incidents: { status: string }[]) {
  const unresolved = incidents.filter((i) => i.status !== "resolved").length;
  const total = incidents.length;
  return Math.max(0, Math.min(100, 100 - total * 5 - unresolved * 10));
}

export function SafetyScore() {
  const { incidents, emergencyActive } = useApp();
  const score = Math.max(0, safetyScore(incidents) - (emergencyActive ? 15 : 0));
  const color = score >= 90 ? "success" : score >= 70 ? "warning" : "destructive";
  const label = score >= 90 ? "Optimal" : score >= 70 ? "Caution" : "Critical";

  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-secondary)" strokeWidth="3.5" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            stroke={`var(--color-${color})`} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 100.5} 100.5`}
            style={{ transition: "stroke-dasharray 0.6s, stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold font-mono" style={{ color: `var(--color-${color})` }}>{score}</div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">/ 100</div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Station Safety Score</div>
        <div className="text-lg font-bold" style={{ color: `var(--color-${color})` }}>{label}</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {incidents.filter((i) => i.status !== "resolved").length} active · {incidents.length} total today
        </div>
      </div>
    </div>
  );
}

export function CrowdPrediction() {
  const trains = useApp((s) => s.trains);
  const active = trains.filter((t) => t.status !== "departed");
  const current = active.reduce((a, t) => a + t.estimatedPax, 0);
  const predicted = Math.round(current * 1.16);
  const peak = active.reduce((a, t) => (t.estimatedPax > (a?.estimatedPax ?? 0) ? t : a), active[0]);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Predictive Crowd Analytics</div>
        <div className="text-[10px] text-muted-foreground">CCTV + capacity fusion</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Current footfall</div>
          <div className="font-mono text-xl font-bold text-primary">{current.toLocaleString("en-IN")}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Predicted (+10m)</div>
          <div className="font-mono text-xl font-bold text-accent">{predicted.toLocaleString("en-IN")}</div>
        </div>
        <div className="col-span-2 mt-1">
          <div className="text-[10px] uppercase text-muted-foreground">Peak density</div>
          <div className="text-sm font-semibold">
            {peak ? (
              <>
                PF {peak.platform} · <span className="font-mono">{peak.expected}</span>
              </>
            ) : (
              <span className="text-muted-foreground italic text-xs">No active trains</span>
            )}
          </div>
        </div>
      </div>
      {/* Sparkline */}
      <div className="mt-3 flex items-end gap-0.5 h-10">
        {active.map((t, i) => {
          const h = Math.max(8, Math.round((t.estimatedPax / t.capacity) * 100));
          const c = h < 30 ? "success" : h < 70 ? "warning" : "destructive";
          return (
            <div key={i} className="flex-1 rounded-t"
                 style={{ height: `${h}%`, background: `var(--color-${c})` }} />
          );
        })}
      </div>
    </div>
  );
}

export function StaffAllocation() {
  const trains = useApp((s) => s.trains);
  const load = trains.filter((t) => t.status !== "departed").reduce((a, t) => a + t.estimatedPax / t.capacity, 0)
    / Math.max(1, trains.filter((t) => t.status !== "departed").length);
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Intelligent Staff Allocation</div>
        <div className="text-[10px] text-muted-foreground">recommended for next 30 min</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {Object.entries(STAFF_MATRIX).map(([k, s]) => {
          const lo = Math.max(1, Math.round(s.min * (load + 0.3)));
          const hi = Math.max(2, Math.round(s.max * (load + 0.3)));
          return (
            <div key={k} className="flex items-center gap-2.5 p-2 rounded-md bg-secondary/30">
              <div className="w-8 h-8 rounded-md flex items-center justify-center font-mono text-xs font-bold"
                   style={{ background: `var(--color-${s.color})20`, color: `var(--color-${s.color})` }}>
                {s.name.slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{lo}–{hi} personnel</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmergencyButton() {
  const { emergencyActive, triggerEmergency, resolveEmergency, createIncident, session } = useApp();
  const [showSim, setShowSim] = useState(false);

  const triggerSim = (type: "intrusion" | "fire" | "medical" | "crowd", pf: number, zone: string, desc: string) => {
    const primaryRole = type === "medical" ? "medical" : type === "intrusion" || type === "fire" ? "rpf" : "station-master";
    const assistRoles: any[] = type === "medical" ? ["rpf", "station-master"] : ["medical", "station-master", "crowd", "ticket"];
    
    createIncident({
      type,
      platform: pf,
      zone: zone as any,
      description: `SIMULATED ALERT: ${desc}`,
      primaryRole,
      assistRoles,
      reportedBy: "station-master",
      priority: "P1",
    });
    setShowSim(false);
  };

  const isMaster = session.role === "station-master";

  return (
    <div className="flex flex-col gap-2 w-full">
      {emergencyActive ? (
        <button
          onClick={resolveEmergency}
          className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider glow-danger animate-pulse"
          style={{ background: "var(--gradient-danger)", color: "white" }}
        >
          ⚠ Emergency Active · Stand Down
        </button>
      ) : (
        <button
          onClick={() => {
            if (confirm("Declare station-wide emergency? All units will be alerted on priority.")) triggerEmergency();
          }}
          className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider text-destructive border-2 border-destructive/60 hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          🚨 Declare Emergency
        </button>
      )}

      {isMaster && (
        <div className="relative">
          <button
            onClick={() => setShowSim(!showSim)}
            className="w-full py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            {showSim ? "Hide Safety Simulator" : "🛠️ Open Safety Simulator"}
          </button>
          
          {showSim && (
            <div className="absolute bottom-full mb-2 right-0 left-0 p-3 panel bg-card border-destructive/30 shadow-2xl z-30 space-y-2 animate-fade-in">
              <div className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>⚠️ Safety & Threat Simulator</span>
                <span className="text-[8px] text-muted-foreground font-normal">Create test alerts</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-[10px]">
                <button
                  onClick={() => triggerSim("intrusion", 4, "middle", "Unauthorized pedestrian detected walking on track line near PF 4.")}
                  className="w-full py-1.5 rounded bg-secondary/50 text-left px-2 border border-border/60 hover:border-primary/50 hover:bg-secondary/80 font-medium text-foreground cursor-pointer"
                >
                  🚶 Track Intrusion (PF 4)
                </button>
                <button
                  onClick={() => triggerSim("intrusion", 1, "front", "Motion alarm triggered in restricted Yard Corridor A.")}
                  className="w-full py-1.5 rounded bg-secondary/50 text-left px-2 border border-border/60 hover:border-primary/50 hover:bg-secondary/80 font-medium text-foreground cursor-pointer"
                >
                  🚧 Restricted Yard Intrusion
                </button>
                <button
                  onClick={() => triggerSim("fire", 9, "rear", "Smoke detection triggered in Food Court service zone near PF 9.")}
                  className="w-full py-1.5 rounded bg-secondary/50 text-left px-2 border border-border/60 hover:border-primary/50 hover:bg-secondary/80 font-medium text-foreground cursor-pointer"
                >
                  🔥 Fire Alarm (Food Court)
                </button>
                <button
                  onClick={() => triggerSim("medical", 12, "middle", "Passenger collapsed with heat stroke symptoms near platform benches.")}
                  className="w-full py-1.5 rounded bg-secondary/50 text-left px-2 border border-border/60 hover:border-primary/50 hover:bg-secondary/80 font-medium text-foreground cursor-pointer"
                >
                  ✚ Passenger Cardiac Distress (PF 12)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
