# OfflinePay Frontend

React + Vite + Tailwind CSS dashboard for the OfflinePay transaction reconciliation simulator.

## Run
npm install
npm run dev

Open http://localhost:5173

## Backend
Default API: http://localhost:8080/api

Optional `.env`:
VITE_API_BASE=http://localhost:8080/api

Expected endpoints:
GET /api/transactions
POST /api/transactions
GET /api/dashboard/stats
GET /api/reconciliation/logs
POST /api/sync
POST /api/reconciliation/{transactionId}
POST /api/reconciliation/{transactionId}/fail

If backend is unavailable, the UI falls back to demo data so the hackathon demo still works.

## Demo
1. Go Offline
2. Generate 3-5 transactions
3. Simulate Duplicate
4. Simulate Conflict
5. Go Online
6. Reconnect & Sync
7. Open transaction details
8. Show Audit Logs
