package com.offlinepay.reconcile.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "reconciliation_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReconciliationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String transactionId;

    @Column(nullable = false, length = 20)
    private String result;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
