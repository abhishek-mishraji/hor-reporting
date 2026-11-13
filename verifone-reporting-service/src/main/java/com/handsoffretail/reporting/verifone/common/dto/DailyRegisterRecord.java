package com.handsoffretail.reporting.verifone.common.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One business day of the daily report, from POS data only.
 * cashDeposit / checkDeposit = safe drops by tender.
 */
public record DailyRegisterRecord(
        LocalDate reportDate,
        BigDecimal groceryTotal,
        BigDecimal volume,
        BigDecimal cashDeposit,
        BigDecimal checkDeposit,
        long noSale,
        long lineVoid,
        BigDecimal voidAmount,
        BigDecimal refunds) {}
