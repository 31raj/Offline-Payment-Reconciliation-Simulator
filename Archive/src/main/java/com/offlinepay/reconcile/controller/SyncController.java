package com.offlinepay.reconcile.controller;

import com.offlinepay.reconcile.entity.PaymentTransaction;
import com.offlinepay.reconcile.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SyncController {

    private final SyncService service;

    @GetMapping("/queue")
    public List<PaymentTransaction> queue() {
        return service.getQueue();
    }

    @PostMapping
    public List<PaymentTransaction> sync() {
        return service.markQueuedAsSynced();
    }
}
