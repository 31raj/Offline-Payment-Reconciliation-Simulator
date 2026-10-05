package com.offlinepay.reconcile.service;

import com.offlinepay.reconcile.controller.DuplicateTransactionException;
import com.offlinepay.reconcile.dto.TransactionRequest;
import com.offlinepay.reconcile.entity.*;
import com.offlinepay.reconcile.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final PaymentTransactionRepository repository;

    @Transactional
    @SuppressWarnings("null")
    public @NonNull PaymentTransaction createOffline(TransactionRequest request) {
        String normalizedTransactionId = normalizeTransactionId(request.transactionId());

        if (repository.existsByTransactionId(normalizedTransactionId)) {
            throw new DuplicateTransactionException("Transaction ID already exists: " + normalizedTransactionId);
        }

        try {
            PaymentTransaction transaction = PaymentTransaction.builder()
                    .transactionId(normalizedTransactionId)
                    .customerId(normalizeText(request.customerId()))
                    .merchantId(normalizeText(request.merchantId()))
                    .amount(request.amount())
                    .source(TransactionSource.OFFLINE)
                    .status(TransactionStatus.QUEUED)
                    .build();

            return repository.save(transaction);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateTransactionException("Transaction ID already exists: " + normalizedTransactionId, ex);
        }
    }

    public List<PaymentTransaction> getAll() {
        return repository.findAll();
    }

    public PaymentTransaction getById(String transactionId) {
        String normalizedTransactionId = normalizeTransactionId(transactionId);
        return repository.findByTransactionId(normalizedTransactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + normalizedTransactionId));
    }

    private String normalizeTransactionId(String transactionId) {
        if (transactionId == null) {
            throw new IllegalArgumentException("Transaction ID is required");
        }
        return transactionId.trim();
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }
}
