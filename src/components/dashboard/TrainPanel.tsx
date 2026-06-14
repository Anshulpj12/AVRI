import { type Train, type CoachInfo } from "@/lib/ndls-data";
import { STAFF_MATRIX } from "@/lib/ndls-data";
import { useApp, ROLE_META, type Role } from "@/lib/store";
import { useState } from "react";

interface Props {
  train: Train | null;
  onClose: () => void;
}

const COACH_BG: Record<CoachInfo["type"], string> = {
  loco: "bg-muted text-muted-foreground border-border/80",
  general: "bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/25",
  sleeper: "bg-warning/15 text-warning border-warning/40 hover:bg-warning/25",
  ac: "bg-success/15 text-success border-success/40 hover:bg-success/25",
  pantry: "bg-muted/70 text-muted-foreground border-border/50",
};

export function TrainPanel({ train, onClose }: Props) {
  const { session, deployments, deployStaff, acceptDuty, requestMedicalBackup } = useApp();
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [medDesc, setMedDesc] = useState("");
  const [showMedForm, setShowMedForm] = useState(false);

  if (!train) return null;

  const role = session.role!;
  const name = session.name;
  const dep = deployments[train.id];

  const pct = Math.round((train.estimatedPax / train.capacity) * 100);
  const predicted = Math.min(train.capacity, Math.round(train.estimatedPax * 1.18));
  
  // Dynamic arrival label
  const minutes = train.minutesToArrival;
  let arrivalLabel = "";
  let arrivalColor = "text-foreground";
  if (train.status === "departed") {
    arrivalLabel = "Departed";
    arrivalColor = "text-muted-foreground";
  } else if (minutes > 0) {
    arrivalLabel = `Arriving in ${minutes}m`;
    arrivalColor = "text-primary";
  } else if (minutes === 0) {
    arrivalLabel = "Arriving now";
    arrivalColor = "text-primary animate-pulse";
  } else {
    arrivalLabel = "At platform";
    arrivalColor = "text-success";
  }

  // Get selected coach details
  const activeCoach = train.coaches.find(c => c.name === selectedCoach);
  
  const handleMedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach) return;
    requestMedicalBackup(train.id, selectedCoach, train.platform, medDesc);
    setMedDesc("");
    setShowMedForm(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative ml-auto w-full max-w-xl h-full panel rounded-none border-y-0 border-r-0 overflow-y-auto"
      >
        {/* Header section */}
        <div className="sticky top-0 z-10 panel rounded-none border-x-0 border-t-0 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">{train.number}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {train.coachCount}-coach rake · {arrivalLabel}
              </span>
            </div>
            <h2 className="text-xl font-bold mt-0.5 truncate">{train.name}</h2>
            <div className="text-sm text-muted-foreground truncate">{train.origin} → {train.destination}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none shrink-0">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Platform" value={`PF ${train.platform}`} accent="primary" />
            <Stat label="Status" value={train.status.toUpperCase()} accent={train.status === "delayed" ? "warning" : train.status === "departed" ? "muted" : "success"} />
            <Stat label="Arrival" value={arrivalLabel} accent="primary" />
            <Stat label="Delay" value={train.delayMin > 0 ? `+${train.delayMin}m` : "On Time"} mono accent={train.delayMin > 0 ? "warning" : "success"} />
          </div>

          {/* Coach-by-coach layout and predictions */}
          <section className="panel p-4 bg-card/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Interactive Coach Layout</h3>
              <span className="text-[10px] text-muted-foreground">Select a coach to view passenger predictions</span>
            </div>
            
            {/* Visual train track with coaches */}
            <div className="overflow-x-auto pb-2 pt-1 scrollbar-thin">
              <div className="flex gap-1.5 min-w-max px-1">
                {train.coaches.map((c) => {
                  const isSel = selectedCoach === c.name;
                  const style = COACH_BG[c.type];
                  return (
                    <button
                      key={c.name}
                      onClick={() => setSelectedCoach(isSel ? null : c.name)}
                      className={`h-9 px-3 border rounded font-mono text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${style} ${
                        isSel ? "ring-2 ring-primary border-primary font-bold scale-[1.03]" : ""
                      }`}
                    >
                      <span>{c.name}</span>
                      {c.type !== "loco" && c.type !== "pantry" && (
                        <span className="text-[8px] opacity-80 mt-0.5">
                          {c.boarding + c.deboarding}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coach density legend */}
            <div className="flex items-center gap-4 mt-2 justify-end text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-success/20 border border-success/40 rounded-sm"></span> AC (Low)</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-warning/20 border border-warning/40 rounded-sm"></span> Sleeper (Med)</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-destructive/20 border border-destructive/40 rounded-sm"></span> General (High)</div>
            </div>

            {/* Coach Details Sub-Panel */}
            {activeCoach ? (
              <div className="mt-3 p-3 rounded-lg bg-secondary/35 border border-border/60 animate-fade-in space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    Coach {activeCoach.name} Details <span className="text-[10px] text-muted-foreground capitalize">({activeCoach.type} class)</span>
                  </div>
                  <button onClick={() => setSelectedCoach(null)} className="text-muted-foreground hover:text-foreground text-xs font-medium">Clear</button>
                </div>

                {activeCoach.type === "loco" || activeCoach.type === "pantry" ? (
                  <div className="text-xs text-muted-foreground italic">No passenger boarding predictions for operational/utility coaches.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="panel p-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">To Board</div>
                      <div className="text-base font-bold text-accent mt-0.5">{activeCoach.boarding} pax</div>
                    </div>
                    <div className="panel p-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">To Deboard</div>
                      <div className="text-base font-bold text-primary mt-0.5">{activeCoach.deboarding} pax</div>
                    </div>
                    <div className="panel p-2 text-center col-span-2 sm:col-span-1">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Local Crowd Load</div>
                      <div className={`text-base font-bold mt-0.5 ${
                        activeCoach.type === "general" ? "text-destructive" : activeCoach.type === "sleeper" ? "text-warning" : "text-success"
                      }`}>
                        {activeCoach.type === "general" ? "CRITICAL" : activeCoach.type === "sleeper" ? "HIGH" : "SAFE"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Emergency assistance trigger inside coach */}
                {role !== "station-master" && (
                  <div className="pt-1">
                    {!showMedForm ? (
                      <button
                        onClick={() => setShowMedForm(true)}
                        className="w-full text-xs py-1.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 font-medium transition-colors"
                      >
                        🚨 Report Medical Emergency in Coach {activeCoach.name}
                      </button>
                    ) : (
                      <form onSubmit={handleMedSubmit} className="space-y-2">
                        <textarea
                          placeholder="Describe symptoms, age or condition (e.g. chest pain, adult male)..."
                          value={medDesc}
                          onChange={(e) => setMedDesc(e.target.value)}
                          rows={2}
                          required
                          className="w-full bg-input border border-border text-xs rounded-md p-2 outline-none focus:border-destructive"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowMedForm(false)}
                            className="flex-1 text-xs py-1 border border-border rounded"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 text-xs py-1 bg-destructive text-destructive-foreground font-semibold rounded"
                          >
                            Request Medical Team
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-center text-xs text-muted-foreground py-2 border border-dashed border-border rounded-md">
                Click on a coach code block above to view specific passenger predictions.
              </div>
            )}
          </section>

          {/* Personnel Deployment & Duty Acceptance Workflow */}
          <section className="panel p-4 bg-card/30">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Intelligent Staff Deployment</h3>
            
            {dep ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Deployment Status:
                    <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                      dep.status === "complete" ? "bg-success/15 text-success border border-success/30" : "bg-warning/15 text-warning border border-warning/30"
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Active Coordination</span>
                </div>

                {/* Progress metrics per department */}
                <div className="space-y-3">
                  {(["rpf", "ticket", "crowd"] as const).map((dept) => {
                    const req = dep.required[dept];
                    const acc = dep.accepted[dept].length;
                    const pct = Math.min(100, Math.round((acc / req) * 100));
                    const label = ROLE_META[dept].label;
                    const color = ROLE_META[dept].color;
                    
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{label}</span>
                          <span className="font-mono font-bold text-muted-foreground">
                            {acc} / {req} accepted
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: `var(--color-${color})`,
                            }}
                          />
                        </div>
                        {dep.accepted[dept].length > 0 && (
                          <div className="text-[10px] text-muted-foreground pl-1 leading-tight">
                            Accepted: {dep.accepted[dept].join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Accept Duty Interaction for Specific Staff */}
                {(role === "rpf" || role === "ticket" || role === "crowd") && (
                  <div className="pt-2">
                    {dep.accepted[role]?.includes(name) ? (
                      <div className="text-center text-xs text-success font-medium py-2 bg-success/10 rounded-md border border-success/30">
                        ✓ You have accepted duty for this train.
                      </div>
                    ) : dep.accepted[role]?.length >= dep.required[role] ? (
                      <div className="text-center text-xs text-muted-foreground py-2 bg-secondary/30 rounded-md">
                        Duty quota filled for your department.
                      </div>
                    ) : (
                      <button
                        onClick={() => acceptDuty(train.id, role, name)}
                        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/95 shadow-md active:scale-[0.99] transition-transform"
                      >
                        ✍ Accept Train Handling Duty
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-3 border border-dashed border-border rounded-lg bg-card/20">
                <div className="text-xs text-muted-foreground">
                  No operational dispatch created for this train yet.
                </div>
                {session.role === "station-master" ? (
                  <button
                    onClick={() => deployStaff(train.id)}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/95 transition-all shadow-md"
                  >
                    Deploy Handling Team
                  </button>
                ) : (
                  <div className="text-[10px] text-muted-foreground italic">
                    Awaiting dispatch calculations from Station Master.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Live timeline */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Live Timeline</h3>
            <div className="space-y-3 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              {train.timeline.map((evt, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className={`mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                    evt.done
                      ? "bg-success border-success"
                      : "bg-card border-primary glow-primary"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{evt.time}</span>
                      {!evt.done && (
                        <span className="text-[9px] uppercase font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">Upcoming</span>
                      )}
                    </div>
                    <div className={`text-sm leading-snug break-words ${evt.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                      {evt.event}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* General crowd analytics */}
          <section className="panel p-4 bg-card/40">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Predictive Crowd Analytics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Row k="Current load" v={`${train.estimatedPax.toLocaleString("en-IN")} (${pct}%)`} />
              <Row k="In 10 min" v={`${predicted.toLocaleString("en-IN")} pax`} />
              <Row k="Capacity" v={`${train.capacity.toLocaleString("en-IN")} pax`} />
            </div>

            {/* Segment heatmap */}
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Platform segment heatmap</div>
              <div className="grid grid-cols-3 gap-2">
                {["Front", "Middle", "Rear"].map((seg, i) => {
                  const segPct = Math.max(0, Math.min(100, pct + (i === 1 ? 15 : i === 0 ? -5 : -10)));
                  const color = segPct < 30 ? "success" : segPct < 70 ? "warning" : "destructive";
                  return (
                    <div key={seg} className="panel p-2 text-center min-w-0">
                      <div className="text-[10px] uppercase text-muted-foreground truncate">{seg}</div>
                      <div className="font-mono text-base sm:text-lg font-bold mt-0.5 tabular-nums" style={{ color: `var(--color-${color})` }}>
                        {segPct}%
                      </div>
                      <div className="h-1 rounded-full mt-1.5" style={{ background: `var(--color-${color})` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div className="panel p-2.5 min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className={`font-bold truncate ${mono ? "font-mono tabular-nums" : ""}`} style={{ color: accent ? `var(--color-${accent})` : undefined }}>
        {value}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm border-b border-border/50 py-1.5 min-w-0">
      <span className="text-muted-foreground truncate">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );
}
