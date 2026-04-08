# Sin City Network

Sin City Network is a full-stack crime intelligence platform with a noir interface, realtime graph updates, REST APIs, and an AI-style analytics layer for detecting hidden ties and suspicious officers.

## Stack

- Frontend: HTML, TailwindCSS via CDN, custom CSS, vanilla JavaScript
- Visualization: D3.js force graphs, tree graph, and heatmap
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Realtime: Socket.io
- AI: logic-based analytics engine for hidden relationship detection, influence scoring, and police corruption suspicion
- Simulation: KGF-style power dynamics engine with succession, betrayal, outsider rise, and event timeline

## Features

- Criminal force-directed network graph with cinematic hover states, tooltips, linked-node highlighting, and profile drawer
- Power dynamics graph with dominance-driven sizing, heir logic, outsider growth, and tension-heavy rivalries
- Criminal hierarchy tree view
- Police network view
- Corruption hybrid graph with color-coded edge semantics
- Crime record system with create and update workflows
- Live graph refresh when people or crimes change
- Dead-status propagation that weakens ties in realtime
- Search, role filters, timeline slider, district crime heatmap, and unstable hierarchy panel
- Story timeline with simulation events such as assassinations, betrayals, raids, and successions
- AI-generated new characters can enter unstable factions or emerge as outsiders over time
- AI-generated characters now arrive with a background tier and full backstory, and the simulation will bias toward lethal corrections when new arrivals outpace deaths by too much
- Play/pause simulation controls plus user-triggered promote, eliminate, and manual event tick actions
- Responsive layout tuned for phones, tablets, and desktop screens

## Project Structure

```text
.
├── public
│   ├── css
│   │   └── styles.css
│   ├── js
│   │   ├── api.js
│   │   ├── app.js
│   │   └── graphs
│   │       ├── forceGraph.js
│   │       ├── heatmap.js
│   │       └── treeGraph.js
│   └── index.html
├── src
│   ├── config
│   │   └── db.js
│   ├── controllers
│   ├── models
│   ├── routes
│   ├── seed
│   │   └── seedData.js
│   ├── services
│   ├── socket
│   └── utils
├── .env.example
├── package.json
├── README.md
└── server.js
```

## Local Setup

1. Install MongoDB locally and make sure it is running.
2. Copy `.env.example` to `.env`.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:5000](http://localhost:5000).

The app auto-seeds the database on first boot.

If you already ran an older version of the project, clear the old `sin-city` database first so the new power-dynamics fields and seed events load cleanly.

## API Surface

### People

- `GET /api/people`
- `POST /api/people`
- `PATCH /api/people/:id`
- `DELETE /api/people/:id`

### Relationships

- `GET /api/relationships`
- `POST /api/relationships`
- `PATCH /api/relationships/:id`
- `DELETE /api/relationships/:id`

### Crimes

- `GET /api/crimes`
- `POST /api/crimes`
- `PATCH /api/crimes/:id`

### Dashboard and AI

- `GET /api/dashboard/graph`
- `GET /api/dashboard/analytics`
- `GET /api/dashboard/events`
- `GET /api/dashboard/simulation`
- `POST /api/dashboard/simulation/toggle`
- `POST /api/dashboard/simulation/tick`
- `POST /api/dashboard/characters/:id/promote`
- `POST /api/dashboard/characters/:id/eliminate`

## Notes

- Framer Motion was not added because this build uses a non-React frontend; motion is handled with CSS and D3 transitions instead.
- Tailwind is loaded through the CDN for a simpler local setup without a frontend build step.
- The simulation engine runs automatically every 18 seconds by default and also supports manual triggering from the UI.
