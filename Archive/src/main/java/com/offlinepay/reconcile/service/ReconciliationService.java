package com.offlinepay.reconcile.service;

import com.offlinepay.reconcile.dto.ServerRecordRequest;
import com.offlinepay.reconcile.entity.PaymentTransaction;
import com.offlinepay.reconcile.entity.ReconciliationLog;
import com.offlinepay.reconcile.entity.TransactionStatus;
import com.offlinepay.reconcile.repository.PaymentTransactionRepository;
import com.offlinepay.reconcile.repository.ReconciliationLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ReconciliationService {

    private final PaymentTransactionRepository transactionRepository;
    private final ReconciliationLogRepository logRepository;


    // =========================================================
    // RECONCILE TRANSACTION
    // =========================================================

    @Transactional
    public PaymentTransaction reconcile(
            String transactionId,
            ServerRecordRequest server) {

        PaymentTransaction local =
                transactionRepository.findByTransactionId(transactionId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Offline transaction not found: "
                                                + transactionId
                                )
                        );

        // Check if already processed
        if (isAlreadyProcessed(local)) {

            local.setStatus(TransactionStatus.DUPLICATE);

            saveLog(
                    transactionId,
                    "DUPLICATE",
                    "Transaction was already processed."
            );

            return transactionRepository.save(local);
        }


        // Compare offline record with server record
        boolean match =
                local.getTransactionId().equals(server.transactionId())
                        && local.getCustomerId().equals(server.customerId())
                        && local.getMerchantId().equals(server.merchantId())
                        && local.getAmount().compareTo(server.amount()) == 0;


        // Records match
        if (match) {

            local.setStatus(TransactionStatus.RECONCILED);

            saveLog(
                    transactionId,
                    "RECONCILED",
                    "Offline and server records matched."
            );

        }

        // Records don't match
        else {

            local.setStatus(TransactionStatus.CONFLICT);

            StringBuilder reason =
                    new StringBuilder("Record mismatch: ");

            if (local.getAmount()
                    .compareTo(server.amount()) != 0) {

                reason.append("amount mismatch. ");
            }

            if (!local.getCustomerId()
                    .equals(server.customerId())) {

                reason.append("customer mismatch. ");
            }

            if (!local.getMerchantId()
                    .equals(server.merchantId())) {

                reason.append("merchant mismatch. ");
            }

            saveLog(
                    transactionId,
                    "CONFLICT",
                    reason.toString().trim()
            );
        }

        return transactionRepository.save(local);
    }


    // =========================================================
    // MARK TRANSACTION FAILED
    // =========================================================

    @Transactional
    public PaymentTransaction markFailed(
            String transactionId,
            String reason) {

        PaymentTransaction transaction =
                transactionRepository.findByTransactionId(transactionId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Transaction not found: "
                                                + transactionId
                                )
                        );


        // Already processed
        if (isAlreadyProcessed(transaction)) {

            transaction.setStatus(TransactionStatus.DUPLICATE);

            saveLog(
                    transactionId,
                    "DUPLICATE",
                    "Transaction was already processed."
            );

            return transactionRepository.save(transaction);
        }


        // Mark as failed
        transaction.setStatus(TransactionStatus.FAILED);

        saveLog(
                transactionId,
                "FAILED",
                reason
        );

        return transactionRepository.save(transaction);
    }


    // =========================================================
    // SIMULATE CONFLICT
    // =========================================================

    @Transactional
    public PaymentTransaction simulateConflict(
            String transactionId) {

        PaymentTransaction transaction =
                transactionRepository.findByTransactionId(transactionId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Transaction not found: "
                                                + transactionId
                                )
                        );


        BigDecimal originalAmount =
                transaction.getAmount();

        BigDecimal serverAmount =
                originalAmount.add(
                        BigDecimal.valueOf(200)
                );


        String reason =
                "Amount mismatch: ₹"
                        + originalAmount
                        + " vs ₹"
                        + serverAmount;


        // Set conflict status
        transaction.setStatus(
                TransactionStatus.CONFLICT
        );


        // Save audit log
        saveLog(
                transactionId,
                "CONFLICT",
                reason
        );


        return transactionRepository.save(transaction);
    }




    // =========================================================
    // SIMULATE DUPLICATE
    // =========================================================

    @Transactional
    public PaymentTransaction simulateDuplicate(String transactionId) {
        PaymentTransaction transaction =
                transactionRepository.findByTransactionId(transactionId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Transaction not found: " + transactionId
                                )
                        );

        transaction.setStatus(TransactionStatus.DUPLICATE);

        saveLog(
                transactionId,
                "DUPLICATE",
                "Duplicate transaction reference detected during reconciliation."
        );

        return transactionRepository.save(transaction);
    }

    // =========================================================
    // CHECK ALREADY PROCESSED
    // =========================================================

    private boolean isAlreadyProcessed(
            PaymentTransaction transaction) {

        TransactionStatus status =
                transaction.getStatus();

        return status == TransactionStatus.RECONCILED
                || status == TransactionStatus.DUPLICATE
                || status == TransactionStatus.CONFLICT
                || status == TransactionStatus.FAILED;
    }


    // =========================================================
    // SAVE RECONCILIATION LOG
    // =========================================================

    @SuppressWarnings("null")
    private void saveLog(
            String transactionId,
            String result,
            String reason) {

        ReconciliationLog log = ReconciliationLog.builder()
                .transactionId(transactionId)
                .result(result)
                .reason(reason)
                .createdAt(LocalDateTime.now())
                .build();

        logRepository.save(log);
    }
}