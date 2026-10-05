package com.offlinepay.reconcile.controller;

import com.offlinepay.reconcile.dto.ServerRecordRequest;
import com.offlinepay.reconcile.entity.PaymentTransaction;
import com.offlinepay.reconcile.entity.ReconciliationLog;
import com.offlinepay.reconcile.repository.ReconciliationLogRepository;
import com.offlinepay.reconcile.service.ReconciliationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reconciliation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReconciliationController {

    private final ReconciliationService service;
    private final ReconciliationLogRepository logRepository;


    // =========================================================
    // GET RECONCILIATION LOGS
    // =========================================================

    @GetMapping("/logs")
    public List<ReconciliationLog> logs() {
        return logRepository.findTop50ByOrderByCreatedAtDesc();
    }


    // =========================================================
    // RECONCILE TRANSACTION
    // =========================================================

    @PostMapping("/{transactionId}")
    public PaymentTransaction reconcile(
            @PathVariable String transactionId,
            @Valid @RequestBody ServerRecordRequest serverRecord) {

        return service.reconcile(
                transactionId,
                serverRecord
        );
    }


    // =========================================================
    // MARK TRANSACTION AS FAILED
    // =========================================================

    @PostMapping("/{transactionId}/fail")
    public PaymentTransaction fail(
            @PathVariable String transactionId,
            @RequestParam(
                    defaultValue = "Synchronization failed"
            )
            String reason) {

        return service.markFailed(
                transactionId,
                reason
        );
    }




    // =========================================================
    // SIMULATE DUPLICATE
    // =========================================================

    @PostMapping("/{transactionId}/simulate-duplicate")
    public PaymentTransaction simulateDuplicate(
            @PathVariable String transactionId) {

        return service.simulateDuplicate(transactionId);
    }

    // =========================================================
    // SIMULATE CONFLICT
    // =========================================================

    @PostMapping("/{transactionId}/simulate-conflict")
    public PaymentTransaction simulateConflict(
            @PathVariable String transactionId) {

        return service.simulateConflict(
                transactionId
        );
    }
}