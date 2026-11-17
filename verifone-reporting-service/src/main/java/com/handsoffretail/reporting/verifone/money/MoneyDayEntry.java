package com.handsoffretail.reporting.verifone.money;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The entered Money Out figures of one store-day. {@code values} holds only the entered fields; a field that is
 * missing uses the POS figure. {@code version} is 0 when nothing was ever entered for the day.
 */
public record MoneyDayEntry(
        long storeId,
        LocalDate businessDate,
        Map<MoneyField, BigDecimal> values,
        int version,
        Long updatedBy,
        String updatedByName,
        OffsetDateTime updatedAt) {

    public MoneyDayEntry {
        values = values.isEmpty() ? Map.of() : Map.copyOf(new EnumMap<>(values));
    }

    public static MoneyDayEntry none(long storeId, LocalDate businessDate) {
        return new MoneyDayEntry(storeId, businessDate, Map.of(), 0, null, null, null);
    }

    /** JSON body of GET / PUT /api/reports/daily-money (snake_case, counts as integers). */
    public Map<String, Object> toJson(String storeCode, boolean canEdit) {
        Map<String, Object> entered = new LinkedHashMap<>();
        for (MoneyField field : MoneyField.values()) {
            BigDecimal v = values.get(field);
            if (v != null) {
                entered.put(field.key(), field.kind() == MoneyField.Kind.COUNT ? (Object) v.intValueExact() : v.setScale(2));
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
