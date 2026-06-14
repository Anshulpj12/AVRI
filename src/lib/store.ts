import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRAINS, type Train, SOP_TEMPLATES, ZONES, PLATFORMS, type Zone, type PlatformInfo } from "./ndls-data";

export type Role = "station-master" | "rpf" | "medical" | "ticket" | "crowd";

export const ROLE_META: Record<Role, { label: string; color: string; emoji: string }> = {
  "station-master": { label: "Station Master", color: "primary", emoji: "🚉" },
  "rpf":            { label: "RPF Officer", color: "info", emoji: "🛡️" },
  "medical":        { label: "Medical Staff", color: "success", emoji: "⚕️" },
  "ticket":         { label: "Ticket Checking", color: "accent", emoji: "🎫" },
  "crowd":          { label: "Crowd Management", color: "warning", emoji: "👥" },
};

export type IncidentType = "medical" | "intrusion" | "crowd" | "fire";
export type IncidentStatus = "active" | "responding" | "resolved";
export type Priority = "P1" | "P2" | "P3";

export interface Assignment {
  id: string;
  role: Role;
  unit: string;
  status: "pending" | "accepted" | "declined" | "enroute" | "onsite";
  assignedAt: number;
  assistRequested?: boolean;
  assistNote?: string;
}

export interface SopTask {
  task: string;
  done: boolean;
  by?: Role;
  updatedAt?: number;
}

export interface Incident {
  id: string;
  type: IncidentType;
  platform: number;
  zone: "front" | "middle" | "rear";
  description: string;
  status: IncidentStatus;
  priority: Priority;
  createdAt: number;
  primaryRole: Role;
  assistRoles: Role[];
  sop: SopTask[];
  assignments: Assignment[];
  reportedBy: Role;
  escalated?: boolean;
}

export interface Notification {
  id: string;
  audience: Role | "all";
  priority: Priority;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  incidentId?: string;
  assignmentId?: string;
  kind: "incident" | "assignment" | "sop" | "emergency" | "system" | "assist";
}

export interface TrainDeployment {
  trainId: string;
  required: { rpf: number; ticket: number; crowd: number };
  accepted: { rpf: string[]; ticket: string[]; crowd: string[] }; // staff names who accepted
  status: "pending" | "dispatched" | "complete";
}

export type QueuedAction =
  | { id: string; ts: number; kind: "notify"; payload: Notification };

interface Session { role: Role | null; name: string; badge: string; }

// Alert rules: per-role per-incident-type priority override (P1 / P2 / P3 / "off").
export type RuleLevel = Priority | "off";
export type AlertRules = Record<Role, Record<IncidentType, RuleLevel>>;

const DEFAULT_RULES: AlertRules = {
  "station-master": { medical: "P1", fire: "P1", intrusion: "P2", crowd: "P2" },
  "rpf":            { medical: "P2", fire: "P1", intrusion: "P1", crowd: "P2" },
  "medical":        { medical: "P1", fire: "P1", intrusion: "P3", crowd: "P2" },
  "ticket":         { medical: "P3", fire: "P2", intrusion: "P3", crowd: "P2" },
  "crowd":          { medical: "P2", fire: "P1", intrusion: "P3", crowd: "P1" },
};

interface AppState {
  session: Session;
  online: boolean;
  lastSync: number;
  trains: Train[];
  incidents: Incident[];
  notifications: Notification[];
  queue: QueuedAction[];
  emergencyActive: boolean;
  alertRules: AlertRules;
  zones: Zone[];
  platforms: PlatformInfo[];
  deployments: Record<string, TrainDeployment>;

  login: (role: Role, name: string, badge: string) => void;
  logout: () => void;
  setOnline: (v: boolean) => void;

  createIncident: (i: Omit<Incident, "id" | "createdAt" | "status" | "sop" | "assignments" | "priority"> & { sop?: Incident["sop"]; priority?: Priority }) => void;
  updateIncident: (id: string, patch: Partial<Incident>) => void;
  toggleSop: (incidentId: string, taskIdx: number, by: Role) => void;

  assignUnit: (incidentId: string, role: Role, unit: string) => void;
  respondAssignment: (incidentId: string, assignmentId: string, status: Assignment["status"]) => void;
  requestAssist: (incidentId: string, assignmentId: string, note?: string) => void;
  respondAssist: (incidentId: string, assignmentId: string, responder: Role, unit: string) => void;

  markNotificationRead: (id: string) => void;
  markAllRead: (role: Role) => void;
  acknowledgeEmergency: (incidentId: string, role: Role) => void;

  setRule: (role: Role, type: IncidentType, level: RuleLevel) => void;
  resetRules: () => void;

  triggerEmergency: () => void;
  resolveEmergency: () => void;
  tickTrains: () => void;
  escalateStale: () => void;

  // Digital map editor actions
  addZone: (z: Omit<Zone, "id">) => void;
  deleteZone: (id: string) => void;
  updatePlatform: (id: number, patch: Partial<PlatformInfo>) => void;

  // Train handling deployment actions
  deployStaff: (trainId: string) => void;
  acceptDuty: (trainId: string, role: Role, staffName: string) => void;
  requestMedicalBackup: (trainId: string, coachName: string, platform: number, desc: string) => void;
}

const priorityFor = (t: IncidentType): Priority =>
  t === "fire" ? "P1" : t === "medical" ? "P1" : t === "intrusion" ? "P2" : "P2";

const uid = (p = "N") => `${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const UNIT_POOL: Record<Role, string[]> = {
  "rpf": ["RPF Squad Alpha", "RPF Squad Bravo", "RPF Quick Reaction"],
  "medical": ["Medical Team 1", "Medical Team 2", "Paramedic Cart"],
  "ticket": ["TTE Group North", "TTE Group South"],
  "crowd": ["Crowd Patrol A", "Crowd Patrol B", "Platform Marshals"],
  "station-master": ["Duty Officer", "Deputy SM"],
};

export const dispatchableUnits = (role: Role) => UNIT_POOL[role];

const STORE_KEY = "ndls-command-center";

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      // Apply per-role priority override (rules) — preserves P1 emergencies.
      const applyRule = (audience: Role | "all", incidentType: IncidentType | null, basePrio: Priority): Priority | null => {
        if (audience === "all" || !incidentType) return basePrio;
        const lvl = get().alertRules[audience]?.[incidentType];
        if (!lvl) return basePrio;
        if (lvl === "off") return null;
        return lvl;
      };

      const deliver = (n: Notification) => {
        const isOnline = get().online;
        if (isOnline) {
          set({ notifications: [n, ...get().notifications].slice(0, 200) });
        } else {
          set({
            queue: [...get().queue, { id: uid("Q"), ts: Date.now(), kind: "notify", payload: n }],
          });
        }
      };

      const notifyRoles = (
        roles: (Role | "all")[],
        opts: Omit<Notification, "id" | "ts" | "read" | "audience">,
        incidentType: IncidentType | null = null,
      ) => {
        const unique = Array.from(new Set(roles));
        unique.forEach((audience) => {
          const p = applyRule(audience, incidentType, opts.priority);
          if (p === null) return; // muted
          deliver({ ...opts, priority: p, id: uid("NT"), ts: Date.now(), read: false, audience });
        });
      };

      return {
        session: { role: null, name: "", badge: "" },
        online: true,
        lastSync: Date.now(),
        trains: TRAINS,
        incidents: [],
        notifications: [],
        queue: [],
        emergencyActive: false,
        alertRules: DEFAULT_RULES,
        zones: ZONES,
        platforms: PLATFORMS,
        deployments: {},

        login: (role, name, badge) => set({ session: { role, name, badge } }),
        logout: () => set({ session: { role: null, name: "", badge: "" } }),

        setOnline: (v) => {
          if (v) {
            const q = get().queue;
            const replayed: Notification[] = q
              .filter((a) => a.kind === "notify")
              .map((a) => ({ ...a.payload, ts: Date.now(), read: false, id: uid("NT") }));
            if (replayed.length) {
              const sys: Notification = {
                id: uid("NT"), ts: Date.now(), read: false, audience: get().session.role ?? "all",
                priority: "P3", kind: "system",
                title: "Synced while offline",
                body: `${replayed.length} update${replayed.length === 1 ? "" : "s"} replayed from queue.`,
              };
              set({
                notifications: [sys, ...replayed, ...get().notifications].slice(0, 200),
                queue: [],
              });
            }
            set({ online: true, lastSync: Date.now() });
          } else {
            set({ online: false });
          }
        },

        createIncident: (i) => {
          const sop = i.sop ?? SOP_TEMPLATES[i.type].map((task) => ({ task, done: false }));
          const priority = i.priority ?? priorityFor(i.type);
          const inc: Incident = {
            ...i,
            id: uid("INC"),
            createdAt: Date.now(),
            status: "active",
            sop,
            priority,
            assignments: [],
          };
          set({ incidents: [inc, ...get().incidents] });
          notifyRoles([inc.primaryRole, ...inc.assistRoles], {
            priority, kind: "incident", incidentId: inc.id,
            title: `${priority} · ${inc.type.toUpperCase()} on PF ${inc.platform}`,
            body: inc.description,
          }, inc.type);
        },

        updateIncident: (id, patch) =>
          set({ incidents: get().incidents.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),

        toggleSop: (incidentId, taskIdx, by) => {
          const inc = get().incidents.find((x) => x.id === incidentId);
          if (!inc) return;
          const now = Date.now();
          const sop = inc.sop.map((t, i) =>
            i === taskIdx
              ? { ...t, done: !t.done, by: !t.done ? by : undefined, updatedAt: now }
              : t,
          );
          const allDone = sop.every((t) => t.done);
          const status: IncidentStatus = allDone ? "resolved" : "responding";
          set({
            incidents: get().incidents.map((x) =>
              x.id === incidentId ? { ...x, sop, status } : x,
            ),
          });
          const done = sop.filter((t) => t.done).length;
          notifyRoles([inc.primaryRole, ...inc.assistRoles], {
            priority: allDone ? "P3" : "P3", kind: "sop", incidentId,
            title: allDone ? `Incident ${inc.id} resolved` : `SOP ${done}/${sop.length} · PF ${inc.platform}`,
            body: `${ROLE_META[by].label} ${sop[taskIdx].done ? "completed" : "reopened"} "${sop[taskIdx].task}"`,
          });
        },

        assignUnit: (incidentId, role, unit) => {
          const inc = get().incidents.find((x) => x.id === incidentId);
          if (!inc) return;
          const a: Assignment = { id: uid("A"), role, unit, status: "pending", assignedAt: Date.now() };
          const assistRoles = inc.assistRoles.includes(role) || inc.primaryRole === role
            ? inc.assistRoles
            : [...inc.assistRoles, role];
          set({
            incidents: get().incidents.map((x) =>
              x.id === incidentId ? { ...x, assignments: [...x.assignments, a], assistRoles } : x,
            ),
          });
          notifyRoles([role], {
            priority: inc.priority, kind: "assignment", incidentId, assignmentId: a.id,
            title: `Assigned: ${unit}`,
            body: `${inc.type.toUpperCase()} · PF ${inc.platform}. Awaiting acceptance.`,
          }, inc.type);
        },

        respondAssignment: (incidentId, assignmentId, status) => {
          const inc = get().incidents.find((x) => x.id === incidentId);
          if (!inc) return;
          const a = inc.assignments.find((x) => x.id === assignmentId);
          set({
            incidents: get().incidents.map((x) =>
              x.id !== incidentId ? x : {
                ...x,
                assignments: x.assignments.map((y) => (y.id === assignmentId ? { ...y, status } : y)),
                status: x.status === "active" && status === "accepted" ? "responding" : x.status,
              },
            ),
          });
          if (a) {
            notifyRoles([inc.primaryRole], {
              priority: "P3", kind: "assignment", incidentId, assignmentId,
              title: `${a.unit} ${status}`,
              body: `${ROLE_META[a.role].label} unit updated assignment status.`,
            });
          }
        },

        requestAssist: (incidentId, assignmentId, note) => {
          const inc = get().incidents.find((x) => x.id === incidentId);
          if (!inc) return;
          const a = inc.assignments.find((x) => x.id === assignmentId);
          if (!a) return;
          set({
            incidents: get().incidents.map((x) =>
              x.id !== incidentId ? x : {
                ...x,
                assignments: x.assignments.map((y) =>
                  y.id === assignmentId ? { ...y, assistRequested: true, assistNote: note } : y,
                ),
              },
            ),
          });
          const allRoles: Role[] = ["station-master", "rpf", "medical", "ticket", "crowd"];
          notifyRoles(allRoles.filter((r) => r !== a.role), {
            priority: "P2", kind: "assist", incidentId, assignmentId: a.id,
            title: `Assist requested · ${a.unit}`,
            body: `${ROLE_META[a.role].label} needs backup on PF ${inc.platform}${note ? ` — ${note}` : ""}.`,
          });
        },

        respondAssist: (incidentId, assignmentId, responder, unit) => {
          const inc = get().incidents.find((x) => x.id === incidentId);
          if (!inc) return;
          const a: Assignment = {
            id: uid("A"), role: responder, unit, status: "accepted", assignedAt: Date.now(),
          };
          set({
            incidents: get().incidents.map((x) =>
              x.id !== incidentId ? x : {
                ...x,
                assignments: [...x.assignments, a],
                assistRoles: x.assistRoles.includes(responder) ? x.assistRoles : [...x.assistRoles, responder],
              },
            ),
          });
          const orig = inc.assignments.find((y) => y.id === assignmentId);
          notifyRoles([inc.primaryRole, ...(orig ? [orig.role] : [])], {
            priority: "P3", kind: "assist", incidentId, assignmentId: a.id,
            title: `${unit} responding`,
            body: `${ROLE_META[responder].label} dispatched to assist on PF ${inc.platform}.`,
          });
        },

        acknowledgeEmergency: (incidentId, role) => {
          set({
            notifications: get().notifications.map((n) =>
              n.incidentId === incidentId && n.kind === "emergency" && (n.audience === role || n.audience === "all")
                ? { ...n, read: true }
                : n,
            ),
          });
          notifyRoles([get().incidents.find((x) => x.id === incidentId)?.reportedBy ?? "station-master"], {
            priority: "P3", kind: "emergency", incidentId,
            title: `${ROLE_META[role].label} acknowledged`,
            body: `Acknowledgement received for emergency ${incidentId}.`,
          });
        },

        markNotificationRead: (id) =>
          set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),

        markAllRead: (role) =>
          set({
            notifications: get().notifications.map((n) =>
              n.audience === role || n.audience === "all" ? { ...n, read: true } : n,
            ),
          }),

        setRule: (role, type, level) =>
          set({
            alertRules: {
              ...get().alertRules,
              [role]: { ...get().alertRules[role], [type]: level },
            },
          }),

        resetRules: () => set({ alertRules: DEFAULT_RULES }),

        triggerEmergency: () => {
          const sop = SOP_TEMPLATES.crowd.map((task) => ({ task, done: false }));
          const inc: Incident = {
            id: uid("EMG"),
            type: "crowd",
            platform: 3,
            zone: "front",
            description: "EMERGENCY: Critical crowd surge declared by Station Master",
            status: "active",
            priority: "P1",
            createdAt: Date.now(),
            primaryRole: "station-master",
            assistRoles: ["rpf", "medical", "ticket", "crowd"],
            sop,
            assignments: [],
            reportedBy: get().session.role ?? "station-master",
          };
          set({ incidents: [inc, ...get().incidents], emergencyActive: true });
          notifyRoles(["all", "rpf", "medical", "ticket", "crowd", "station-master"], {
            priority: "P1", kind: "emergency", incidentId: inc.id,
            title: "P1 · STATION-WIDE EMERGENCY",
            body: "All units report to PF 3. Acknowledge immediately.",
          });
        },

        resolveEmergency: () => set({ emergencyActive: false }),

        tickTrains: () => {
          set({
            trains: get().trains.map((t) => {
              const drift = Math.round((Math.random() - 0.5) * t.capacity * 0.04);
              const est = Math.max(0, Math.min(t.capacity, t.estimatedPax + drift));
              
              let m = t.minutesToArrival;
              let status = t.status;
              if (status !== "departed") {
                if (m > 0) {
                  m -= 1;
                } else if (m === 0) {
                  status = status === "arriving" ? "boarding" : status === "on-time" || status === "delayed" ? "arriving" : status;
                  m = -1;
                }
              }
              
              return { ...t, estimatedPax: est, minutesToArrival: m, status };
            }),
            lastSync: get().online ? Date.now() : get().lastSync,
          });
          get().escalateStale();
        },

        escalateStale: () => {
          const now = Date.now();
          let changed = false;
          const incidents = get().incidents.map((i) => {
            if (i.status === "resolved" || i.escalated) return i;
            const accepted = i.assignments.some((a) => a.status === "accepted" || a.status === "enroute" || a.status === "onsite");
            const stale = now - i.createdAt > 2 * 60 * 1000;
            if (stale && !accepted && i.priority !== "P1") {
              changed = true;
              notifyRoles([i.primaryRole, ...i.assistRoles], {
                priority: "P1", kind: "emergency", incidentId: i.id,
                title: `Escalated to P1 · ${i.id}`,
                body: `No acceptance in 2 min. ${i.type.toUpperCase()} on PF ${i.platform}.`,
              });
              return { ...i, priority: "P1" as Priority, escalated: true };
            }
            return i;
          });
          if (changed) set({ incidents });
        },

        // Map Editor Actions
        addZone: (z) => {
          const newZone: Zone = { ...z, id: uid("Z") };
          set({ zones: [...get().zones, newZone] });
          notifyRoles(["station-master"], {
            priority: "P3", kind: "system",
            title: "Map Updated: Zone Added",
            body: `New zone "${newZone.label}" (${newZone.type}) configured by Station Master.`,
          });
        },

        deleteZone: (id) => {
          const zone = get().zones.find((z) => z.id === id);
          if (!zone) return;
          set({ zones: get().zones.filter((z) => z.id !== id) });
          notifyRoles(["station-master"], {
            priority: "P3", kind: "system",
            title: "Map Updated: Zone Removed",
            body: `Zone "${zone.label}" removed from station layout.`,
          });
        },

        updatePlatform: (id, patch) => {
          set({
            platforms: get().platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          });
          notifyRoles(["station-master"], {
            priority: "P3", kind: "system",
            title: `Platform PF ${id} Updated`,
            body: `Configuration modified for Platform ${id} (Length: ${patch.length}m, Type: ${patch.type}).`,
          });
        },

        // Train Handling Deployment Actions
        deployStaff: (trainId) => {
          const train = get().trains.find((t) => t.id === trainId);
          if (!train) return;
          
          const capFactor = train.capacity / 1000;
          const delayFactor = train.delayMin > 0 ? 1.4 : 1.0;
          
          const rpf = Math.max(1, Math.round(3 * capFactor * delayFactor));
          const ticket = Math.max(1, Math.round(2 * capFactor));
          const crowd = Math.max(1, Math.round(4 * capFactor * delayFactor));
          
          const newDep: TrainDeployment = {
            trainId,
            required: { rpf, ticket, crowd },
            accepted: { rpf: [], ticket: [], crowd: [] },
            status: "dispatched",
          };
          
          set({
            deployments: {
              ...get().deployments,
              [trainId]: newDep,
            },
          });
          
          // Send alerts only to RPF, Ticket Checking, and Crowd Management staff initially!
          notifyRoles(["rpf", "ticket", "crowd"], {
            priority: "P2", kind: "assignment",
            title: `Train Duty Dispatch: PF ${train.platform}`,
            body: `Deploying staff for ${train.number} (${train.name}). Required: RPF (${rpf}), Ticket (${ticket}), Crowd (${crowd}).`,
          });
        },

        acceptDuty: (trainId, role, staffName) => {
          const dep = get().deployments[trainId];
          if (!dep) return;
          if (role !== "rpf" && role !== "ticket" && role !== "crowd") return;
          
          const list = [...dep.accepted[role]];
          if (list.includes(staffName)) return; // already accepted
          
          list.push(staffName);
          const acceptedObj = { ...dep.accepted, [role]: list };
          
          const allFilled =
            acceptedObj.rpf.length >= dep.required.rpf &&
            acceptedObj.ticket.length >= dep.required.ticket &&
            acceptedObj.crowd.length >= dep.required.crowd;
            
          const status = allFilled ? "complete" : "dispatched";
          
          set({
            deployments: {
              ...get().deployments,
              [trainId]: { ...dep, accepted: acceptedObj, status },
            },
          });
          
          const train = get().trains.find((t) => t.id === trainId);
          notifyRoles(["station-master"], {
            priority: "P3", kind: "system",
            title: "Duty Accepted",
            body: `${staffName} (${ROLE_META[role].label}) accepted duty for Train ${train?.number ?? ""}.`,
          });
          
          if (allFilled && train) {
            notifyRoles(["station-master", "rpf", "ticket", "crowd"], {
              priority: "P3", kind: "system",
              title: `Deployment Complete · Train ${train.number}`,
              body: `All required handling staff have accepted duties for Platform ${train.platform}.`,
            });
          }
        },

        requestMedicalBackup: (trainId, coachName, platform, desc) => {
          const train = get().trains.find(t => t.id === trainId);
          const details = train ? `${train.number} (${train.name})` : "Arriving Train";
          
          get().createIncident({
            type: "medical",
            platform,
            zone: "middle",
            description: `EMERGENCY MEDICAL TEAM NEEDED: Requested by staff at Coach ${coachName} of ${details}. ${desc}`,
            primaryRole: "medical",
            assistRoles: ["rpf", "station-master"],
            reportedBy: get().session.role ?? "station-master",
            priority: "P1",
          });
        },
      };
    },
    {
      name: STORE_KEY,
      version: 4,
      migrate: (persisted: any, version) => {
        if (!persisted) return persisted;
        if (version < 2) {
          persisted.incidents = (persisted.incidents ?? []).map((i: any) => ({
            ...i,
            priority: i.priority ?? "P2",
            assignments: i.assignments ?? [],
          }));
          persisted.notifications = persisted.notifications ?? [];
          persisted.queue = persisted.queue ?? [];
        }
        if (version < 3) {
          persisted.alertRules = persisted.alertRules ?? DEFAULT_RULES;
        }
        if (version < 4) {
          persisted.zones = persisted.zones ?? ZONES;
          persisted.platforms = persisted.platforms ?? PLATFORMS;
          persisted.deployments = persisted.deployments ?? {};
          persisted.alertRules = { ...DEFAULT_RULES, ...persisted.alertRules };
        }
        return persisted;
      },
      partialize: (s) => ({
        session: s.session,
        incidents: s.incidents,
        trains: s.trains,
        notifications: s.notifications,
        queue: s.queue,
        emergencyActive: s.emergencyActive,
        lastSync: s.lastSync,
        alertRules: s.alertRules,
        zones: s.zones,
        platforms: s.platforms,
        deployments: s.deployments,
      }),
    },
  ),
);

// ─── Cross-tab live sync ────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORE_KEY) {
      useApp.persist.rehydrate();
    }
  });
}
