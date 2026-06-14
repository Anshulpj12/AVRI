// Realistic NDLS (New Delhi Railway Station) static data — simulates live feed.
// 16 platforms, real train numbers/routes.

export type TrainStatus = "on-time" | "delayed" | "arriving" | "boarding" | "departed";
export type CrowdLevel = "low" | "medium" | "high" | "critical";

export interface CoachInfo {
  name: string; // e.g. "LOCO", "G1", "S1", "PC", "A1"
  type: "general" | "sleeper" | "ac" | "pantry" | "loco";
  boarding: number;
  deboarding: number;
}

export interface Train {
  id: string;
  number: string;
  name: string;
  origin: string;
  destination: string;
  platform: number;
  scheduled: string;     // HH:MM
  expected: string;      // HH:MM
  status: TrainStatus;
  delayMin: number;
  capacity: number;
  estimatedPax: number;  // current/expected passengers
  coachCount: number;
  nextStop: { name: string; eta: string; distanceKm: number };
  timeline: { time: string; event: string; done: boolean }[];
  coaches: CoachInfo[];
  minutesToArrival: number;
}

export interface PlatformInfo {
  id: number;
  name: string;
  length: number;
  segments: 3;
  type: "terminal" | "through";
}

export const STATION = {
  code: "NDLS",
  name: "New Delhi Railway Station",
  city: "New Delhi",
  zone: "Northern Railway",
  platforms: 16,
};

export const PLATFORMS: PlatformInfo[] = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: `PF ${i + 1}`,
  length: 600,
  segments: 3,
  type: i < 4 ? "terminal" : "through",
}));

// Generates high-fidelity coach-by-coach boarding and deboarding predictions
export function generateCoaches(capacity: number, estimatedPax: number, coachCount: number): CoachInfo[] {
  const coaches: CoachInfo[] = [];
  
  // 1. Add locomotive
  coaches.push({ name: "LOCO", type: "loco", boarding: 0, deboarding: 0 });
  
  const generalCount = 2;
  const acCount = Math.floor((coachCount - 4) * 0.4);
  const sleeperCount = Math.max(2, coachCount - 2 - generalCount - acCount - 1); // general, AC, PC, loco
  
  // Distribute estimated pax (approx. 60% boarding, 40% deboarding for terminal/through average)
  const isTerminal = estimatedPax > 0 && Math.random() > 0.5;
  const boardingRatio = isTerminal ? 0.85 : 0.45;
  const deboardingRatio = 1 - boardingRatio;
  
  const totalBoarding = Math.round(estimatedPax * boardingRatio);
  const totalDeboarding = Math.round(estimatedPax * deboardingRatio);
  
  let distributedBoarding = 0;
  let distributedDeboarding = 0;

  const addCoachesOfType = (prefix: string, type: CoachInfo["type"], count: number) => {
    for (let i = 1; i <= count; i++) {
      // Boarding/deboarding weights: general coaches are heavily crowded, AC are moderately crowded
      const weight = type === "general" ? 1.6 : type === "ac" ? 0.7 : 1.0;
      
      let b = 0;
      let d = 0;
      
      if (estimatedPax > 0) {
        b = Math.round((totalBoarding / (coachCount - 2)) * weight * (0.85 + Math.sin(i) * 0.15));
        d = Math.round((totalDeboarding / (coachCount - 2)) * weight * (0.85 + Math.cos(i) * 0.15));
      }
      
      distributedBoarding += b;
      distributedDeboarding += d;
      
      coaches.push({
        name: `${prefix}${i}`,
        type,
        boarding: b,
        deboarding: d,
      });
    }
  };

  // General Unreserved (Front)
  addCoachesOfType("GEN-F", "general", Math.floor(generalCount / 2));
  
  // Sleeper Class
  addCoachesOfType("S", "sleeper", sleeperCount);
  
  // Pantry Car
  coaches.push({ name: "PC", type: "pantry", boarding: 0, deboarding: 0 });
  
  // AC Coaches
  addCoachesOfType("B", "ac", acCount);
  
  // General Unreserved (Rear)
  addCoachesOfType("GEN-R", "general", Math.ceil(generalCount / 2));

  // Correct small rounding errors to match estimatedPax
  if (estimatedPax > 0 && coaches.length > 2) {
    const errorB = totalBoarding - distributedBoarding;
    const errorD = totalDeboarding - distributedDeboarding;
    
    // adjust first sleeper coach
    const target = coaches.find(c => c.type === "sleeper");
    if (target) {
      target.boarding = Math.max(0, target.boarding + errorB);
      target.deboarding = Math.max(0, target.deboarding + errorD);
    }
  }

  return coaches;
}

export const TRAINS: Train[] = [
  {
    id: "t1", number: "12302", name: "Howrah Rajdhani Exp",
    origin: "New Delhi", destination: "Howrah Jn",
    platform: 3, scheduled: "16:55", expected: "16:55",
    status: "boarding", delayMin: 0, capacity: 1280, estimatedPax: 1088,
    coachCount: 22, minutesToArrival: 5,
    nextStop: { name: "Kanpur Central", eta: "17:55", distanceKm: 440 },
    timeline: [
      { time: "16:20", event: "Rake placed on platform", done: true },
      { time: "16:30", event: "Reservation chart prepared", done: true },
      { time: "16:40", event: "Passenger boarding started", done: true },
      { time: "16:55", event: "Scheduled departure", done: false },
    ],
    coaches: generateCoaches(1280, 1088, 22),
  },
  {
    id: "t2", number: "12952", name: "Mumbai Rajdhani Exp",
    origin: "New Delhi", destination: "Mumbai Central",
    platform: 1, scheduled: "17:00", expected: "17:08",
    status: "delayed", delayMin: 8, capacity: 1320, estimatedPax: 1188,
    coachCount: 20, minutesToArrival: 18,
    nextStop: { name: "Kota Jn", eta: "19:42", distanceKm: 458 },
    timeline: [
      { time: "16:25", event: "Rake placement (delayed)", done: true },
      { time: "16:45", event: "Chart prepared", done: true },
      { time: "17:00", event: "Boarding in progress", done: false },
      { time: "17:08", event: "Revised departure", done: false },
    ],
    coaches: generateCoaches(1320, 1188, 20),
  },
  {
    id: "t3", number: "12004", name: "Lucknow Shatabdi Exp",
    origin: "New Delhi", destination: "Lucknow",
    platform: 12, scheduled: "15:35", expected: "15:35",
    status: "departed", delayMin: 0, capacity: 1100, estimatedPax: 0,
    coachCount: 14, minutesToArrival: -35,
    nextStop: { name: "Ghaziabad", eta: "15:55", distanceKm: 24 },
    timeline: [
      { time: "15:20", event: "Boarding completed", done: true },
      { time: "15:35", event: "Departed on time", done: true },
    ],
    coaches: generateCoaches(1100, 0, 14),
  },
  {
    id: "t4", number: "12259", name: "Sealdah Duronto Exp",
    origin: "Sealdah", destination: "New Delhi",
    platform: 7, scheduled: "16:50", expected: "16:54",
    status: "arriving", delayMin: 4, capacity: 1240, estimatedPax: 1116,
    coachCount: 21, minutesToArrival: 4,
    nextStop: { name: "Terminating · NDLS", eta: "17:00", distanceKm: 0 },
    timeline: [
      { time: "16:32", event: "Departed Ghaziabad", done: true },
      { time: "16:48", event: "Entered NDLS yard", done: true },
      { time: "16:54", event: "Arriving at PF 7", done: false },
      { time: "17:05", event: "Passenger de-boarding", done: false },
    ],
    coaches: generateCoaches(1240, 1116, 21),
  },
  {
    id: "t5", number: "12626", name: "Kerala Express",
    origin: "New Delhi", destination: "Thiruvananthapuram",
    platform: 9, scheduled: "17:15", expected: "17:15",
    status: "on-time", delayMin: 0, capacity: 1480, estimatedPax: 740,
    coachCount: 24, minutesToArrival: 25,
    nextStop: { name: "Mathura Jn", eta: "18:32", distanceKm: 141 },
    timeline: [
      { time: "16:30", event: "Rake under maintenance", done: true },
      { time: "16:55", event: "Rake placement scheduled", done: false },
      { time: "17:15", event: "Departure", done: false },
    ],
    coaches: generateCoaches(1480, 740, 24),
  },
  {
    id: "t6", number: "12423", name: "Dibrugarh Rajdhani",
    origin: "New Delhi", destination: "Dibrugarh",
    platform: 5, scheduled: "16:45", expected: "16:45",
    status: "boarding", delayMin: 0, capacity: 1260, estimatedPax: 1071,
    coachCount: 21, minutesToArrival: -5,
    nextStop: { name: "Moradabad", eta: "18:55", distanceKm: 150 },
    timeline: [
      { time: "16:10", event: "Rake placed", done: true },
      { time: "16:25", event: "Boarding started", done: true },
      { time: "16:45", event: "Departure", done: false },
    ],
    coaches: generateCoaches(1260, 1071, 21),
  },
  {
    id: "t7", number: "22691", name: "KSR Bengaluru Rajdhani",
    origin: "Hazrat Nizamuddin", destination: "KSR Bengaluru",
    platform: 14, scheduled: "17:30", expected: "17:30",
    status: "on-time", delayMin: 0, capacity: 1240, estimatedPax: 620,
    coachCount: 20, minutesToArrival: 40,
    nextStop: { name: "Mathura Jn", eta: "18:12", distanceKm: 141 },
    timeline: [
      { time: "17:00", event: "Rake placement", done: false },
      { time: "17:15", event: "Boarding starts", done: false },
      { time: "17:30", event: "Departure", done: false },
    ],
    coaches: generateCoaches(1240, 620, 20),
  },
  {
    id: "t8", number: "12309", name: "Rajendra Nagar Rajdhani",
    origin: "Rajendra Nagar T", destination: "New Delhi",
    platform: 16, scheduled: "16:40", expected: "16:58",
    status: "delayed", delayMin: 18, capacity: 1280, estimatedPax: 1152,
    coachCount: 22, minutesToArrival: 8,
    nextStop: { name: "Terminating · NDLS", eta: "17:00", distanceKm: 0 },
    timeline: [
      { time: "16:15", event: "Departed Aligarh", done: true },
      { time: "16:50", event: "Held at outer signal", done: true },
      { time: "16:58", event: "Arriving at PF 16 (revised)", done: false },
    ],
    coaches: generateCoaches(1280, 1152, 22),
  },
];

export interface Zone {
  id: string;
  label: string;
  type: "entry" | "exit" | "waiting" | "restricted" | "medical" | "rpf" | "facility";
  x: number;
  y: number;
}

export const ZONES: Zone[] = [
  { id: "ent-paharganj", label: "Entry • Paharganj", type: "entry", x: 6, y: 18 },
  { id: "ent-ajmeri", label: "Entry • Ajmeri Gate", type: "entry", x: 6, y: 82 },
  { id: "exit-main", label: "Exit • Main Concourse", type: "exit", x: 94, y: 50 },
  { id: "wait-1", label: "Waiting Hall A", type: "waiting", x: 18, y: 30 },
  { id: "wait-2", label: "AC Lounge", type: "waiting", x: 18, y: 70 },
  { id: "rest-1", label: "Restricted • Track Yard", type: "restricted", x: 82, y: 10 },
  { id: "med-1", label: "Medical Room A", type: "medical", x: 30, y: 8 },
  { id: "med-2", label: "Medical Room B", type: "medical", x: 70, y: 92 },
  { id: "rpf-1", label: "RPF Post North", type: "rpf", x: 26, y: 92 },
  { id: "rpf-2", label: "RPF Post South", type: "rpf", x: 74, y: 8 },
  { id: "food", label: "Food Court", type: "facility", x: 50, y: 95 },
  { id: "ticket", label: "Ticketing Counter", type: "facility", x: 12, y: 50 },
];

export const SOP_TEMPLATES: Record<string, string[]> = {
  medical: [
    "Medical team dispatched",
    "Patient stabilized on-site",
    "First-aid administered",
    "Stretcher / wheelchair arranged",
    "Patient moved to Medical Room",
    "Family / kin notified",
    "Incident logged in register",
  ],
  intrusion: [
    "RPF squad deployed",
    "Suspect detained / cleared",
    "Track inspection performed",
    "Loco pilot alerted",
    "CCTV footage secured",
    "FIR filed at RPF post",
  ],
  crowd: [
    "PA announcement issued",
    "Additional RPF deployed",
    "Crowd-control barricades placed",
    "Entry temporarily regulated",
    "Medical standby positioned",
    "Adjacent platform opened",
    "Crowd density restored to safe levels",
  ],
  fire: [
    "Fire alarm activated",
    "Evacuation announcement made",
    "Fire tenders called",
    "Affected zone isolated",
    "Passenger headcount conducted",
    "Power isolated in zone",
  ],
};

export const STAFF_MATRIX = {
  rpf: { name: "RPF", min: 3, max: 5, color: "info" },
  ticket: { name: "Ticket Checking", min: 2, max: 4, color: "accent" },
  crowd: { name: "Crowd Management", min: 4, max: 7, color: "primary" },
  medical: { name: "Medical Support", min: 1, max: 2, color: "success" },
};
