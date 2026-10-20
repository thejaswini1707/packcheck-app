# PackCheck — Full-stack compliance dashboard

A runnable full-stack starter inspired by the supplied PackCheck reference image. It includes:

- Express backend with JWT authentication
- Persistent JSON datastore (no external database server required)
- Product image uploads
- Server-side compliance analysis driven by editable rules stored in the datastore
- Scan history, reports, e-commerce comparison
- Real-time Server-Sent Events (SSE) for dashboard counters and recent scans
- Responsive dashboard UI with editable fields and no screenshot-based UI
- Seed data so the dashboard is useful immediately after first launch

## Requirements

- Node.js 20+
- npm 10+

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

Default demo account:

- Email: `demo@packcheck.local`
- Password: `Demo@12345`

Change the JWT secret and demo credentials before production use.

## Development

```bash
npm run dev
```

## Configuration

Copy `.env.example` to `.env` and set values such as `PORT`, `JWT_SECRET`, and `MAX_UPLOAD_MB`.

## Architecture

```text
Browser
  │
  ├── REST API (JWT)
  ├── SSE /api/events (live updates)
  └── multipart upload
          │
        Express
          │
   ┌──────┴────────┐
   │               │
Compliance      Datastore
Engine          data/db.json
   │
Uploads → uploads/
```

The frontend never owns the dashboard metrics or scan history; those are loaded from the backend. The compliance checks are driven from rules in the datastore, so you can add/edit rules without changing the UI.

## Production notes

For production, replace the JSON datastore with PostgreSQL/MySQL, use object storage for uploads, put the app behind HTTPS, rotate `JWT_SECRET`, add rate limiting/CSRF protection as appropriate, and use a real OCR provider or Tesseract service if automated label extraction is required.
