package com.handsoffretail.reporting.verifone.lottery;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Body of PUT /api/reports/daily-lottery: {@code version} = the version the caller loaded (0 when nothing was
 * entered yet); {@code values} = the fields to change, a number to enter it or {@code null} to go back to the
 * POS figure. Fields that are not listed keep their current value.
 */
public record LotteryEntryRequest(Integer version, Map<String, BigDecimal> values) {
}
