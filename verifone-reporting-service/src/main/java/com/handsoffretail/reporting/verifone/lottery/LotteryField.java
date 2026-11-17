package com.handsoffretail.reporting.verifone.lottery;

import java.util.Arrays;
import java.util.Optional;

/**
 * The lottery figures admin and staff may enter for one store-day (Daily report: "Lottery Tickets Sold" and
 * "Lottery/Lotto Reading"). The JSON key, the column of report.lottery_day_entry and the history field name
 * are all {@link #key()}. Same enum in both reporting services.
 */
public enum LotteryField {
    LOTTERY_SALES("lottery_sales", Kind.AMOUNT),
    LOTTERY_TICKETS("lottery_tickets", Kind.COUNT),
    SCRATCH_SALES("scratch_sales", Kind.AMOUNT),
    SCRATCH_TICKETS("scratch_tickets", Kind.COUNT),
    ONLINE_SALES("online_sales", Kind.AMOUNT),
    ONLINE_TICKETS("online_tickets", Kind.COUNT),
    ONLINE_CASHES("online_cashes", Kind.AMOUNT),
    SCRATCH_CASHES("scratch_cashes", Kind.AMOUNT),
    CASHES_TICKETS("cashes_tickets", Kind.COUNT),
    SETTLEMENT("settlement", Kind.AMOUNT),
    ADJUSTMENT("adjustment", Kind.AMOUNT),
    ONLINE_CREDIT("online_credit", Kind.AMOUNT),
    SCRATCH_CREDIT("scratch_credit", Kind.AMOUNT),
    COMMISSION("commission", Kind.AMOUNT);

    public enum Kind { AMOUNT, COUNT }

    private final String key;
    private final Kind kind;

    LotteryField(String key, Kind kind) {
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

    public static Optional<LotteryField> fromKey(String key) {
        return Arrays.stream(values()).filter(f -> f.key.equals(key)).findFirst();
    }
}
