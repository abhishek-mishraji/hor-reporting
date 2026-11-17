package com.handsoffretail.reporting.verifone.money;

import java.util.Arrays;
import java.util.Optional;

/**
 * The Money Out figures admin and staff may enter for one store-day (Daily report: "Safe Deposits").
 * Total deposits = cash deposit + check deposit. The JSON key, the column of report.money_day_entry and the
 * history field name are all {@link #key()}. Same enum in both reporting services.
 */
public enum MoneyField {
    CASH_DEPOSIT("cash_deposit", Kind.AMOUNT),   // POS: safe drops
    CHECK_DEPOSIT("check_deposit", Kind.AMOUNT), // not in the POS: 0 until entered
    CARD_BATCH("card_batch", Kind.AMOUNT);       // POS: credit, debit, pump and mobile card payments

    public enum Kind { AMOUNT, COUNT }

    private final String key;
    private final Kind kind;

    MoneyField(String key, Kind kind) {
        this.key = key;
        this.kind = kind;
    }

    /** JSON key, table column and history field name (a fixed identifier, safe to put in SQL). */
    public String key() {
        return key;
    }

    public Kind kind() {
        return kind;
    }

    public static Optional<MoneyField> fromKey(String key) {
        return Arrays.stream(values()).filter(f -> f.key.equals(key)).findFirst();
    }
}
