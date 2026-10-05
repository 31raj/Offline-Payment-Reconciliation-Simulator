import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

const normalizeTransaction = (tx) => ({
  ...tx,
  id: tx.transactionId ?? tx.id,
  customer: tx.customerId ?? tx.customer ?? '',
  merchant: tx.merchantId ?? tx.merchant ?? '',
  amount: Number(tx.amount ?? 0),
  timestamp: tx.createdAt ?? tx.timestamp,
  time: tx.createdAt
    ? new Date(tx.createdAt).toLocaleTimeString([], { hour12: false })
    : tx.time
});

const normalizeLog = (log) => ({
  ...log,
  id: log.id ?? `${log.transactionId ?? 'LOG'}-${log.createdAt ?? Date.now()}`,
  action: log.result === 'CONFLICT' ? 'Reconciliation' : log.result === 'DUPLICATE' ? 'Duplicate Detection' : log.result,
  tx: log.transactionId ?? log.tx ?? '—',
  result: log.result ?? 'INFO',
  detail: log.reason ?? log.detail ?? '',
  time: log.createdAt
    ? new Date(log.createdAt).toLocaleTimeString([], { hour12: false })
    : log.time
});

export async function getTransactions() {
  const data = (await api.get('/transactions')).data;
  return Array.isArray(data) ? data.map(normalizeTransaction) : data;
}

export async function createTransaction(payload) {
  return normalizeTransaction((await api.post('/transactions', payload)).data);
}

export async function syncTransactions() {
  return (await api.post('/sync')).data;
}

export async function getStats() {
  return (await api.get('/dashboard/stats')).data;
}

export async function getLogs() {
  const data = (await api.get('/reconciliation/logs')).data;
  return Array.isArray(data) ? data.map(normalizeLog) : data;
}

export async function reconcileTransaction(id, payload) {
  return normalizeTransaction((await api.post(`/reconciliation/${encodeURIComponent(id)}`, payload)).data);
}

export async function failTransaction(id, reason) {
  return normalizeTransaction((await api.post(`/reconciliation/${encodeURIComponent(id)}/fail`, null, { params: { reason } })).data);
}

export async function simulateConflict(id) {
  return normalizeTransaction((await api.post(`/reconciliation/${encodeURIComponent(id)}/simulate-conflict`)).data);
}

export async function simulateDuplicate(id) {
  return normalizeTransaction((await api.post(`/reconciliation/${encodeURIComponent(id)}/simulate-duplicate`)).data);
}
