package com.offlinepay.reconcile.entity;

public enum TransactionStatus {
    QUEUED,
    SYNCED,
    RECONCILED,
    DUPLICATE,
    CONFLICT,
    FAILED
}
