package com.offlinepay.reconcile.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record TransactionRequest(
    @NotBlank String transactionId,
    @NotBlank String customerId,
    @NotBlank String merchantId,
    @NotNull @DecimalMin("0.01") BigDecimal amount
) {}
