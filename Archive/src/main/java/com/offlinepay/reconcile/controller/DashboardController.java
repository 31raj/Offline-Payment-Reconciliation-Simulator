package com.offlinepay.reconcile.controller;

import com.offlinepay.reconcile.dto.DashboardStats;
import com.offlinepay.reconcile.entity.TransactionStatus;
import com.offlinepay.reconcile.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DashboardController {

    private final PaymentTransactionRepository repository;

    @GetMapping("/stats")
    public DashboardStats stats() {
        return new DashboardStats(
                repository.count(),
                repository.countByStatus(TransactionStatus.QUEUED),
                repository.countByStatus(TransactionStatus.RECONCILED),
                repository.countByStatus(TransactionStatus.DUPLICATE),
                repository.countByStatus(TransactionStatus.CONFLICT),
                repository.countByStatus(TransactionStatus.FAILED),
                repository.countByStatus(TransactionStatus.SYNCED)
        );
    }
}
