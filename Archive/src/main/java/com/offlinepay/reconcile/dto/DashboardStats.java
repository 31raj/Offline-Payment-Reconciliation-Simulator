package com.offlinepay.reconcile.dto;

public record DashboardStats(
    long total,
    long queued,
    long reconciled,
    long duplicates,
    long conflicts,
    long failed,
    long synced
) {}
