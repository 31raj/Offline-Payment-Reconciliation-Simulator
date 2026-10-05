# OfflinePay Reconcile — Spring Boot Backend

Backend for a hackathon simulator that demonstrates offline payment transaction synchronization and reconciliation.

## Stack
- Java 17
- Spring Boot 3.5
- Spring Data JPA
- MySQL
- REST APIs
- Maven

## Setup

1. Install Java 17+ and MySQL.
2. Open `src/main/resources/application.properties`.
3. Replace:
   `spring.datasource.password=YOUR_MYSQL_PASSWORD`
   with your MySQL password.
4. Start MySQL.
5. Run:

```bash
mvn spring-boot:run
```

Backend runs at `http://localhost:8080`.

## Main APIs

### Create offline transaction
POST `/api/transactions`

```json
{
  "transactionId": "TXN1001",
  "customerId": "C101",
  "merchantId": "M501",
  "amount": 500
}
```

### View all transactions
GET `/api/transactions`

### View offline queue
GET `/api/sync/queue`

### Sync queued transactions
POST `/api/sync`

### Reconcile against server record
POST `/api/reconciliation/TXN1001`

```json
{
  "transactionId": "TXN1001",
  "customerId": "C101",
  "merchantId": "M501",
  "amount": 500
}
```

Exact match -> `RECONCILED`

Mismatch -> `CONFLICT`

Already reconciled -> `DUPLICATE`

### Simulate failure
POST `/api/reconciliation/TXN1001/fail?reason=Network%20timeout`

### Reconciliation logs
GET `/api/reconciliation/logs`

### Dashboard stats
GET `/api/dashboard/stats`

## Demo flow

1. Create 3-5 offline transactions.
2. Show them as `QUEUED`.
3. Call `/api/sync`.
4. Reconcile one with exact server data -> `RECONCILED`.
5. Reconcile another with different amount -> `CONFLICT`.
6. Reconcile an already reconciled transaction again -> `DUPLICATE`.
7. Use dashboard stats API for frontend cards.

## Important
This is a simulation. It does not connect to a real payment gateway or move real money.
