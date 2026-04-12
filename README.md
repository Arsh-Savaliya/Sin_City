# Nocturne

Nocturne is a Sin City themed crime-intelligence web app built for HackNite 2026.  
It mixes a live criminal network, police corruption tracking, AI-generated world events, and a simple deduction game where the user must identify a hidden culprit from clues in the feed.

## Problem Statement

Crime data is usually hard to read when it is spread across logs, case notes, and disconnected profiles.  
Nocturne turns that chaos into one readable interface where an operator can:

- watch the city evolve in real time
- inspect relationships between criminals and police
- follow AI feed clues
- solve the active culprit hunt before the three guesses run out

## Why It Fits The Theme

- Noir visual language with a Sin City atmosphere
- Criminal empires, corrupt officers, rivalries, murders, and case files
- Hidden culprit gameplay layered on top of a living underworld simulation

## Core Features

- Authentication with per-user worlds
- Live criminal, police, and corruption network views
- AI feed that logs world events, clue drops, case creation, case solving, deaths, and power recalibration
- Editable operator profile
- Hidden culprit game with 3 guesses and restart flow
- 40-second autonomous AI tick plus manual force tick
- Responsive dashboard built for desktop and mobile

## Tech Stack

- Frontend: React via browser modules + TailwindCSS
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Realtime refresh: Socket.IO
- Auth: JWT
- AI layer: local simulation logic only

## Project Structure

```text
.
|-- public
|   |-- css
|   |-- index.html
|   `-- react
|       |-- api
|       |-- components
|       |-- data
|       |-- hooks
|       |-- lib
|       |-- utils
|       |-- app.js
|       `-- main.js
|-- src
|   |-- models.js
|   |-- seed
|   `-- services.js
|-- server.js
|-- package.json
`-- README.md
```

## Local Setup

1. Create a `.env` file.
2. Add your MongoDB connection string and JWT secret.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:5000](http://localhost:5000)

## Example `.env`

```env
MONGODB_URI=mongodb://127.0.0.1:27017/nocturne
JWT_SECRET=change-this-secret
PORT=5000
```

## Main API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

### Dashboard

- `GET /api/dashboard/graph`
- `GET /api/dashboard/analytics`
- `GET /api/dashboard/events`
- `GET /api/dashboard/simulation`
- `POST /api/dashboard/simulation/toggle`
- `POST /api/dashboard/simulation/tick`
- `POST /api/dashboard/culprit/guess`
- `POST /api/dashboard/culprit/restart`

## Judge Demo Flow

1. Log in as an operator.
2. Open the network and show live criminal/police relationships.
3. Show the AI feed generating clues and world events.
4. Open `User Details` and make a culprit guess.
5. Force a tick to show the world update instantly.

## Deployment Notes

- Frontend + backend can be served together from the Express app.
- Recommended hosting: Render for the app and MongoDB Atlas for the database.
- Keep secrets in environment variables only.

## What Makes This Submission Strong

- Clear Sin City theme fit
- Full frontend-backend-database-auth flow
- Simple but interesting gameplay loop
- Clean, modular project structure
- Easy to demo in a short judging window
