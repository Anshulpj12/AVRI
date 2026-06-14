# NDLS Command Center (Live Station Operations)

A modern, production-grade, local-first operational dashboard for the **New Delhi Railway Station (NDLS)**. Built for station masters and duty staff (RPF, Medical, and Ticketing), this command center coordinates live train schedules, crowd flow predictions, incident reporting, and SOP workflows in real-time.

---

## 🚀 Key Features

*   **Live Interactive Schematic Map**: Displays the 16-platform layout of NDLS, tracking platform occupancy, live segment heatmaps, zones (waiting rooms, medical rooms, RPF posts), and active incidents.
*   **Predictive Crowd Analytics**: Uses simulated CCTV and passenger capacity data to forecast upcoming station footfall, locate peak density platforms, and visualize density trends.
*   **Unified Incident Management & SOPs**: Raise alerts (medical emergency, track intrusion, fire, or crowd surge) with automatic SOP checklist generation.
*   **Intelligent Unit Dispatching**: Assign RPF squads, medical staff, or ticketing officers with real-time status updates (pending, accepted, enroute, onsite, declined).
*   **Smart Alert Routing Rules**: Custom-tune which roles receive which notification priorities (P1, P2, P3, or muted) for each category of incident.
*   **Offline-First & Auto-Sync**: Keep operating during network outages. State changes queue locally and automatically replay upon reconnection.
*   **Zero-Latency Cross-Tab Coordination**: Multi-screen sync handles live synchronization across different browser windows instantly via standard Web Storage API listeners.

---

## 🛠️ Tech Stack

*   **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19 + Vite SSR framework)
*   **Routing**: [TanStack Router](https://tanstack.com/router/v1) (Type-safe, file-based routing)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand) with persistence and cross-tab storage sync
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using native `@tailwindcss/vite` configuration)
*   **Icons & Components**: [Lucide React](https://lucide-react.dev/) & [Radix UI Primitives](https://www.radix-ui.com/)

---

## 💻 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your system.

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd "faraway final"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Server

Start the development server with live reloading:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the console. Open multiple tabs to test the real-time cross-tab state syncing!

### Production Build

Build the application for production:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

---

## 📂 Project Structure

```
├── src/
│   ├── components/      # UI components and dashboard widgets
│   │   └── dashboard/   # Live widgets (Map, TrainList, IncidentDrawer, etc.)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Global stores (Zustand), types, and static data
│   ├── routes/          # TanStack file-based routes (__root layout, index page)
│   ├── styles.css       # Global CSS with OKLCH theme and custom animations
│   ├── server.ts        # Server entry wrapper
│   └── start.ts         # Client entrypoint
├── vite.config.ts       # Vite config integrated with TanStack Start
└── tsconfig.json        # TypeScript configuration
```

---

## 🚉 Operating Roles

1.  **Station Master**: Accesses a full view of the station, manages general alerts, coordinates large-scale crowd flows, and can dispatch any team.
2.  **RPF Officer**: Focuses on security incidents, track intrusions, and fire containment.
3.  **Medical Staff**: Primary responder for medical emergencies, first-aid logs, and patient transports.
4.  **Ticket Checking (TTE)**: Coordinates boarding queues, platform crowds, and assists other roles.
