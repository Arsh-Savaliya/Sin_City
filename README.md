# VELVET n VICE

VELVET n VICE is a neo-noir crime intelligence dashboard built as a single Node.js application. It combines a browser-based React UI, an Express API, MongoDB persistence, and a lightweight simulation engine that keeps the city moving with live events, network shifts, and a culprit-hunt game loop.

## Features

- Username and password authentication
- Per-user world state stored in MongoDB
- Criminal, police, and corruption network views
- Live event feed powered by a local simulation engine
- Hidden culprit investigation game with limited guesses
- Operator profile editing
- Single-service deployment: frontend and backend served by Express

## Tech Stack

- Backend: Node.js, Express, Mongoose, Socket.IO
- Frontend: React via browser modules
- Graphs: D3.js
- Database: MongoDB
- Auth: JWT
- Logging and middleware: Morgan, CORS, dotenv

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
|   |-- seed.js
|   `-- services.js
|-- server.js
|-- package.json
`-- README.md
```

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/sin-city
JWT_SECRET=change-this-secret
```

Notes:

- `PORT` is optional in local development.
- `MONGODB_URI` is required.
- `JWT_SECRET` should be replaced with a strong random secret in production.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your `.env` file.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open:

   ```text
   http://localhost:5000
   ```

The app serves both the API and frontend from the same process.

## Authentication

- Login uses `username + password`
- Registration uses `username + password`

## Available Scripts

```bash
npm start
npm run dev
npm run seed
```

- `npm start`: run the production server
- `npm run dev`: run with nodemon
- `npm run seed`: run the seed script manually

## Main Routes

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

### Entities

- `GET /api/people`
- `POST /api/people`
- `PATCH /api/people/:id`
- `DELETE /api/people/:id`
- `GET /api/crimes`
- `POST /api/crimes`
- `PATCH /api/crimes/:id`
- `GET /api/relationships`
- `POST /api/relationships`
- `PATCH /api/relationships/:id`
- `DELETE /api/relationships/:id`

## Railway Deployment

This project can be deployed as a single Railway web service.

### Recommended Setup

- App hosting: Railway
- Database: MongoDB Atlas

### Railway Settings

- Build command: leave empty
- Start command: `npm start`
- Healthcheck path: `/health`

### Required Railway Variables

```env
MONGODB_URI=your-atlas-connection-string
JWT_SECRET=your-production-secret
```

### Deployment Notes

- The app already listens on `process.env.PORT`, so Railway will inject the runtime port automatically.
- The frontend is served from Express, so no separate frontend service is needed.
- Make sure MongoDB Atlas network access allows Railway to connect.


## Production Checklist

- Set `MONGODB_URI`
- Set a strong `JWT_SECRET`
- Keep `.env` out of git
- Rotate secrets if they were ever committed publicly
- Confirm MongoDB Atlas IP/network access allows the deployed service