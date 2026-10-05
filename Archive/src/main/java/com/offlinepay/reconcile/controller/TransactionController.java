package com.offlinepay.reconcile.controller;

import com.offlinepay.reconcile.dto.TransactionRequest;
import com.offlinepay.reconcile.entity.PaymentTransaction;
import com.offlinepay.reconcile.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TransactionController {

    private final TransactionService service;

    @PostMapping
    public ResponseEntity<PaymentTransaction> create(@Valid @RequestBody TransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createOffline(request));
    }

    @GetMapping
    public List<PaymentTransaction> all() {
        return service.getAll();
    }

    @GetMapping("/{transactionId}")
    public PaymentTransaction get(@PathVariable String transactionId) {
        return service.getById(transactionId);
    }
}
