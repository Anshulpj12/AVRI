import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { Train } from "@/lib/ndls-data";
import type { Incident } from "@/lib/store";

import { Login } from "@/components/dashboard/Login";
import { TopBar } from "@/components/dashboard/TopBar";
import { Ticker } from "@/components/dashboard/Ticker";
import { StationMap } from "@/components/dashboard/StationMap";
import { TrainList } from "@/components/dashboard/TrainList";
import { TrainPanel } from "@/components/dashboard/TrainPanel";
import { IncidentList } from "@/components/dashboard/IncidentList";
import { IncidentDrawer } from "@/components/dashboard/IncidentDrawer";
import { SafetyScore, CrowdPrediction, StaffAllocation, EmergencyButton } from "@/components/dashboard/Widgets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NDLS Command Center · Live Station Operations" },
      { name: "description", content: "Unified real-time command console for New Delhi Railway Station — live trains, predictive crowd analytics, incident response and SOP-driven coordination across RPF, Medical and Ticketing." },
      { property: "og:title", content: "NDLS Command Center" },
      { property: "og:description", content: "Live operational dashboard for India's busiest railway station." },
    ],
  }),
  component: Page,
});

function Page() {
  const { session, tickTrains, online } = useApp();
  const [train, setTrain] = useState<Train | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);

  // simulate live updates every 5 sec when online
  useEffect(() => {
    if (!online) return;
    const i = setInterval(() => tickTrains(), 5000);
    return () => clearInterval(i);
  }, [online, tickTrains]);

  if (!session.role) return <Login />;

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <TopBar />
      <Ticker />

      <main className="flex-1 grid gap-3 p-3 lg:p-4 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[1fr_auto]">
        {/* Map (top-left, spans rows) */}
        <section className="lg:row-span-1">
          <StationMap onSelectTrain={setTrain} onSelectIncident={setIncident} />
        </section>

        {/* Right column: incidents + trains stacked + pending duties */}
        <section className="lg:row-span-2 flex flex-col gap-3 min-h-0">
          <PendingDutiesList onSelectTrain={setTrain} />

          <div className="flex-1 min-h-[250px]">
            <IncidentList onSelect={setIncident} selectedId={incident?.id} />
          </div>
          <div className="flex-1 min-h-[250px]">
            <TrainList onSelect={setTrain} selectedId={train?.id} />
          </div>
        </section>

        {/* Bottom widgets row */}
        <section className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.4fr_0.9fr]">
          <SafetyScore />
          <CrowdPrediction />
          <StaffAllocation />
          <div className="flex items-center"><EmergencyButton /></div>
        </section>
      </main>

      <TrainPanel train={train} onClose={() => setTrain(null)} />
      <IncidentDrawer incident={incident} onClose={() => setIncident(null)} />
    </div>
  );
}

function PendingDutiesList({ onSelectTrain }: { onSelectTrain: (t: Train) => void }) {
  const { session, deployments, trains, acceptDuty } = useApp();
  const role = session.role;
  const name = session.name;

  if (!role || role === "station-master" || role === "medical") return null;

  // Filter deployments where quota is not filled for current role and user hasn't accepted yet
  const pending = Object.values(deployments).filter((dep) => {
    if (dep.status !== "dispatched") return false;
    const req = dep.required[role] ?? 0;
    const acc = dep.accepted[role]?.length ?? 0;
    if (acc >= req) return false;
    
    const alreadyAccepted = dep.accepted[role]?.includes(name);
    return !alreadyAccepted;
  });

  if (pending.length === 0) return null;

  return (
    <div className="panel flex flex-col bg-card/60 border-primary/30 max-h-[260px] overflow-hidden shrink-0 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/25 bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative w-2 h-2 rounded-full bg-primary pulse-dot" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Pending duties ({pending.length})</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {pending.map((dep) => {
          const train = trains.find((t) => t.id === dep.trainId);
          if (!train) return null;

          return (
            <div key={dep.trainId} className="p-3 panel bg-secondary/15 border border-border/50 flex items-center justify-between gap-3 rounded-lg">
              <div className="min-w-0">
                <button
                  onClick={() => onSelectTrain(train)}
                  className="font-bold text-sm text-primary hover:underline text-left truncate block w-full"
                >
                  Train {train.number} · {train.name}
                </button>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Platform {train.platform} · ETA: {train.minutesToArrival > 0 ? `${train.minutesToArrival} mins` : "Arriving"}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/80 mt-1 flex gap-2">
                  <span>RPF: {dep.accepted.rpf.length}/{dep.required.rpf}</span>
                  <span>Ticket: {dep.accepted.ticket.length}/{dep.required.ticket}</span>
                  <span>Crowd: {dep.accepted.crowd.length}/{dep.required.crowd}</span>
                </div>
              </div>
              <button
                onClick={() => acceptDuty(train.id, role, name)}
                className="text-[10px] bg-primary text-primary-foreground font-bold px-3 py-2 rounded-md hover:bg-primary/95 transition-all shadow shrink-0 active:scale-95"
              >
                Accept Duty
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
