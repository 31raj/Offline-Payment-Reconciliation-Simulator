package com.offlinepay.reconcile.repository;

import com.offlinepay.reconcile.entity.ReconciliationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReconciliationLogRepository extends JpaRepository<ReconciliationLog, Long> {
    List<ReconciliationLog> findTop50ByOrderByCreatedAtDesc();
}
