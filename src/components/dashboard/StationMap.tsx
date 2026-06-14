import { type Zone, type PlatformInfo, type Train } from "@/lib/ndls-data";
import { useApp, type Incident } from "@/lib/store";
import { useState, useRef, useEffect } from "react";

const zoneStyle: Record<string, { fill: string; ring: string; icon: string }> = {
  entry:      { fill: "var(--color-success)", ring: "var(--color-success)", icon: "→" },
  exit:       { fill: "var(--color-info)",    ring: "var(--color-info)",    icon: "↦" },
  waiting:    { fill: "var(--color-accent)",  ring: "var(--color-accent)",  icon: "◉" },
  restricted: { fill: "var(--color-destructive)", ring: "var(--color-destructive)", icon: "⊘" },
  medical:    { fill: "var(--color-success)", ring: "var(--color-success)", icon: "✚" },
  rpf:        { fill: "var(--color-info)",    ring: "var(--color-info)",    icon: "🛡" },
  facility:   { fill: "var(--color-muted-foreground)", ring: "var(--color-muted-foreground)", icon: "■" },
};

function platformLoad(p: number, trains: Train[]) {
  const t = trains.find((tr) => tr.platform === p && tr.status !== "departed");
  if (!t) return { pct: 0, train: null as Train | null };
  return { pct: Math.round((t.estimatedPax / t.capacity) * 100), train: t };
}

function loadColor(pct: number) {
  if (pct === 0) return "var(--color-muted)";
  if (pct < 30) return "var(--color-success)";
  if (pct < 70) return "var(--color-warning)";
  return "var(--color-destructive)";
}

interface Props {
  onSelectTrain: (t: Train) => void;
  onSelectIncident: (i: Incident) => void;
}

export function StationMap({ onSelectTrain, onSelectIncident }: Props) {
  const {
    trains, incidents, emergencyActive,
    zones, platforms, addZone, deleteZone, updatePlatform, session
  } = useApp();

  const active = incidents.filter((i) => i.status !== "resolved");
  const isMaster = session.role === "station-master";

  // Map editor states
  const [editing, setEditing] = useState(false);
  const [zoneLabel, setZoneLabel] = useState("");
  const [zoneType, setZoneType] = useState<Zone["type"]>("waiting");
  const [newZoneCoords, setNewZoneCoords] = useState<{ x: number; y: number } | null>(null);

  // Platform editor states
  const [editPfId, setEditPfId] = useState<number>(1);
  const [pfLength, setPfLength] = useState<number>(600);
  const [pfType, setPfType] = useState<PlatformInfo["type"]>("through");

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load selected platform's details when active platform changes in editor
  useEffect(() => {
    const pf = platforms.find((p) => p.id === editPfId);
    if (pf) {
      setPfLength(pf.length);
      setPfType(pf.type);
    }
  }, [editPfId, platforms]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    // Bounds check to avoid placing elements completely outside boundaries
    const boundedX = Math.max(3, Math.min(97, x));
    const boundedY = Math.max(3, Math.min(97, y));
    
    setNewZoneCoords({ x: boundedX, y: boundedY });
  };

  const handleAddZone = () => {
    if (!zoneLabel.trim() || !newZoneCoords) return;
    addZone({
      label: zoneLabel.trim(),
      type: zoneType,
      x: newZoneCoords.x,
      y: newZoneCoords.y,
    });
    setZoneLabel("");
    setNewZoneCoords(null);
  };

  const handleSavePlatform = () => {
    updatePlatform(editPfId, {
      length: pfLength,
      type: pfType,
    });
  };

  return (
    <div className="relative panel overflow-hidden h-full min-h-[520px] flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Live Schematic</div>
          <div className="font-semibold">NDLS · 16 Platform Layout</div>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && (
            <button
              onClick={() => setEditing(!editing)}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                editing
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {editing ? "💾 Stop Customizing" : "🛠️ Customize Map"}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-3 text-[11px]">
            <Legend swatch="var(--color-success)" label="Low 0-30%" />
            <Legend swatch="var(--color-warning)" label="Med 30-70%" />
            <Legend swatch="var(--color-destructive)" label="High 70%+" />
          </div>
        </div>
      </div>

      {/* Editor Banner Panel */}
      {editing && isMaster && (
        <div className="bg-primary/5 border-b border-border/80 p-3 space-y-3 shrink-0 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">🛠️ Station Layout Editor Mode</span>
            <span className="text-[10px] text-muted-foreground">Define corridors, gates, waiting rooms and platforms</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Zone Form */}
            <div className="panel p-2.5 bg-card/60 space-y-2">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Add Custom Zone</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="e.g. Waiting Hall C"
                  value={zoneLabel}
                  onChange={(e) => setZoneLabel(e.target.value)}
                  className="bg-input border border-border text-xs rounded-md px-2.5 py-1.5 outline-none focus:border-primary w-full"
                />
                <select
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value as any)}
                  className="bg-input border border-border text-xs rounded-md px-2 py-1"
                >
                  <option value="entry">Entry Gate</option>
                  <option value="exit">Exit Gate</option>
                  <option value="waiting">Waiting Area</option>
                  <option value="restricted">Restricted Zone</option>
                  <option value="medical">Medical Room</option>
                  <option value="rpf">RPF Post</option>
                  <option value="facility">Facility</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground pt-1">
                <span>{newZoneCoords ? `Placed: X:${newZoneCoords.x}% Y:${newZoneCoords.y}%` : "Click on schematic map below to position"}</span>
                {newZoneCoords && zoneLabel.trim() && (
                  <button
                    type="button"
                    onClick={handleAddZone}
                    className="bg-primary text-primary-foreground font-semibold px-2.5 py-1 rounded hover:bg-primary/90 text-[10px]"
                  >
                    Save Zone
                  </button>
                )}
              </div>
            </div>

            {/* Platform Tweaker */}
            <div className="panel p-2.5 bg-card/60 space-y-2 md:col-span-2">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Configure Platform Dimensions</div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={editPfId}
                  onChange={(e) => setEditPfId(Number(e.target.value))}
                  className="bg-input border border-border text-xs rounded-md px-2 py-1"
                >
                  {platforms.map(p => (
                    <option key={p.id} value={p.id}>Platform {p.id}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 min-w-0">
                  <input
                    type="number"
                    value={pfLength}
                    onChange={(e) => setPfLength(Number(e.target.value))}
                    className="bg-input border border-border text-xs rounded-md px-2.5 py-1.5 outline-none focus:border-primary w-full text-center font-mono"
                    placeholder="Length"
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">m</span>
                </div>
                <select
                  value={pfType}
                  onChange={(e) => setPfType(e.target.value as any)}
                  className="bg-input border border-border text-xs rounded-md px-2 py-1"
                >
                  <option value="through">Through platform</option>
                  <option value="terminal">Terminal platform</option>
                </select>
              </div>
              <div className="text-right pt-1">
                <button
                  type="button"
                  onClick={handleSavePlatform}
                  className="bg-primary text-primary-foreground font-semibold px-2.5 py-1 rounded hover:bg-primary/90 text-[10px]"
                >
                  Save Platform Config
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map canvas wrapper */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div
          ref={canvasRef}
          onClick={handleMapClick}
          className={`relative h-full min-h-[460px] min-w-[750px] lg:min-w-0 grid-bg transition-all ${
            editing ? "cursor-crosshair border-2 border-dashed border-primary/20 bg-primary/5" : ""
          }`}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-y-0 w-1/3 scan-line opacity-30" />
          </div>

          {/* Concourse spine */}
          <div className="absolute left-[6%] right-[6%] top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          {/* Placing zone marker overlay */}
          {editing && newZoneCoords && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-md border-2 border-dashed border-primary flex items-center justify-center text-xs text-primary animate-pulse bg-primary/10"
              style={{ left: `${newZoneCoords.x}%`, top: `${newZoneCoords.y}%` }}
            >
              ＋
            </div>
          )}

          {/* Zones */}
          {zones.map((z) => {
            const s = zoneStyle[z.type];
            return (
              <div
                key={z.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-default"
                style={{ left: `${z.x}%`, top: `${z.y}%` }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border-2 relative"
                  style={{ background: `${s.fill}30`, borderColor: s.ring, color: s.ring }}
                >
                  {s.icon}
                  {editing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteZone(z.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center border border-border hover:bg-destructive/80"
                      title="Delete zone"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 mt-1 text-[9px] whitespace-nowrap text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                  {z.label}
                </div>
              </div>
            );
          })}

          {/* Platforms grid */}
          <div className="absolute inset-x-[12%] inset-y-[18%] grid grid-cols-2 gap-3">
            {[0, 1].map((col) => (
              <div key={col} className="grid grid-rows-8 gap-2">
                {platforms.slice(col * 8, col * 8 + 8).map((p) => {
                  const { pct, train } = platformLoad(p.id, trains);
                  const incident = active.find((i) => i.platform === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => train && onSelectTrain(train)}
                      className={`relative h-full rounded-md border bg-card/60 hover:bg-card transition-all text-left px-2 py-1 ${
                        incident ? "border-destructive glow-danger" : "border-border hover:border-primary/60"
                      }`}
                    >
                      {/* Segments heatmap */}
                      <div className="absolute inset-y-0 right-1.5 w-1.5 flex flex-col gap-0.5 py-1">
                        {[0, 1, 2].map((seg) => {
                          const segPct = train ? Math.min(100, pct + (seg === 1 ? 15 : seg === 0 ? -5 : -10)) : 0;
                          return (
                            <div
                              key={seg}
                              className="flex-1 rounded-sm"
                              style={{ background: loadColor(Math.max(0, segPct)) }}
                            />
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-mono font-bold text-muted-foreground w-6">PF{p.id}</div>
                        {train ? (
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold truncate">{train.name}</div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              {train.number} · {train.expected} {p.type === "terminal" ? "· Term" : ""}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground italic">
                            — vacant · {p.length}m —
                          </div>
                        )}
                      </div>

                      {incident && (
                        <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-destructive text-destructive-foreground pulse-dot" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Incident pins (corner badges) */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 z-10">
            {active.slice(0, 4).map((i) => (
              <button
                key={i.id}
                onClick={() => onSelectIncident(i)}
                className="glass text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 hover:border-destructive/60"
              >
                <span className="w-2 h-2 rounded-full bg-destructive pulse-dot text-destructive" />
                <span className="font-mono text-[10px]">{i.id}</span>
                <span className="text-muted-foreground">PF{i.platform}</span>
                <span className="capitalize">{i.type}</span>
              </button>
            ))}
          </div>

          {emergencyActive && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider glow-danger"
                 style={{ background: "var(--gradient-danger)", color: "white" }}>
              ⚠ Emergency Mode Active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="w-3 h-3 rounded-sm" style={{ background: swatch }} />
      {label}
    </div>
  );
}
