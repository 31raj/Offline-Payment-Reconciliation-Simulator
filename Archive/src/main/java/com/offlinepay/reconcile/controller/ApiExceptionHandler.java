package com.offlinepay.reconcile.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of(
                "timestamp", LocalDateTime.now(),
                "error", "BAD_REQUEST",
                "message", ex.getMessage()
        ));
    }

    @ExceptionHandler(DuplicateTransactionException.class)
    public ResponseEntity<Map<String,Object>> duplicate(DuplicateTransactionException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", LocalDateTime.now(),
                "error", "DUPLICATE_TRANSACTION",
                "message", ex.getMessage()
        ));
    }
}
