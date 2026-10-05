package com.offlinepay.reconcile.controller;

public class DuplicateTransactionException extends RuntimeException {
    public DuplicateTransactionException(String message) {
        super(message);
    }

    public DuplicateTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
