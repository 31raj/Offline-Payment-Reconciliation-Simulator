package com.offlinepay.reconcile.service;

import com.offlinepay.reconcile.entity.*;
import com.offlinepay.reconcile.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final PaymentTransactionRepository repository;

    @Transactional
    public List<PaymentTransaction> getQueue() {
        return repository.findByStatus(TransactionStatus.QUEUED);
    }

    @Transactional
    public List<PaymentTransaction> markQueuedAsSynced() {
        List<PaymentTransaction> queue = repository.findByStatus(TransactionStatus.QUEUED);
        queue.forEach(tx -> tx.setStatus(TransactionStatus.SYNCED));
        return repository.saveAll(queue);
    }
}
