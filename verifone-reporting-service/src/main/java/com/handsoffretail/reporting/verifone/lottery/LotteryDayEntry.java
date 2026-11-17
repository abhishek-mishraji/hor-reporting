package com.handsoffretail.reporting.verifone.lottery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The entered lottery figures of one store-day. {@code values} holds only the entered fields; a field that is
 * missing uses the POS figure. {@code version} is 0 when nothing was ever entered for the day.
 */
public record LotteryDayEntry(
        long storeId,
        LocalDate businessDate,
        Map<LotteryField, BigDecimal> values,
        int version,
        Long updatedBy,
        String updatedByName,
        OffsetDateTime updatedAt) {

    public LotteryDayEntry {
        values = values.isEmpty() ? Map.of() : Map.copyOf(new EnumMap<>(values));
    }

    public static LotteryDayEntry none(long storeId, LocalDate businessDate) {
        return new LotteryDayEntry(storeId, businessDate, Map.of(), 0, null, null, null);
    }

    /** JSON body of GET / PUT /api/reports/daily-lottery (snake_case, counts as integers). */
    public Map<String, Object> toJson(String storeCode, boolean canEdit) {
        Map<String, Object> entered = new LinkedHashMap<>();
        for (LotteryField field : LotteryField.values()) {
            BigDecimal v = values.get(field);
            if (v != null) {
                entered.put(field.key(), field.kind() == LotteryField.Kind.COUNT ? (Object) v.intValueExact() : v.setScale(2));
            }
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("store_code", storeCode);
        body.put("business_date", businessDate);
        body.put("can_edit", canEdit);
        body.put("version", version);
        body.put("values", entered);
        body.put("updated_by_name", updatedByName);
        body.put("updated_at", updatedAt);
        return body;
    }
}
