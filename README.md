# OfflinePay Reconciliation Simulator

Hackathon-ready full-stack simulator for offline payment synchronization and reconciliation.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Spring Boot 3.5.6 + Java 21
- Database: MySQL 8+

## Run backend
1. Create the database:
   `CREATE DATABASE offlinepay;`
2. Ensure MySQL is running with user `root` and an empty password, or update `Archive/src/main/resources/application.properties`.
3. From `Archive` run:
   `mvn spring-boot:run`
4. Backend: http://localhost:8080

## Run frontend
From `OfflinePay-Frontend-FRESH (1)`:
```bash
npm install
npm run dev
```
Frontend: http://localhost:5173

The frontend uses `http://localhost:8080/api` by default. Copy `.env.example` to `.env` only if you want to override it.

## Demo flow
1. Start backend + frontend.
2. Create a transaction. It is stored as `QUEUED` in MySQL.
3. Click Sync to move queued records to `SYNCED`.
4. Reconcile a synced transaction to get `RECONCILED` when records match.
5. Use Simulate Conflict to create an amount mismatch and audit it as `CONFLICT`.
6. Use Simulate Duplicate to mark a transaction as `DUPLICATE` and create an audit log.
7. Use Fail to demonstrate failed synchronization and retry/error handling.
