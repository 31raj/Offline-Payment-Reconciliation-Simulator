package com.offlinepay.reconcile.repository;

import com.offlinepay.reconcile.entity.PaymentTransaction;
import com.offlinepay.reconcile.entity.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Optional<PaymentTransaction> findByTransactionId(String transactionId);
    List<PaymentTransaction> findByStatus(TransactionStatus status);
    long countByStatus(TransactionStatus status);
    boolean existsByTransactionId(String transactionId);
}
