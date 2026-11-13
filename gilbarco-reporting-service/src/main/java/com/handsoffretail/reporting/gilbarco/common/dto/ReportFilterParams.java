package com.handsoffretail.reporting.gilbarco.common.dto;

import java.time.LocalDate;

public record ReportFilterParams(
        String store,
        LocalDate from,
        LocalDate to,
        boolean byDay,
        String format,
        Integer dept,
        String itemType,
        String salesClass,
        boolean byPriceLevel,
        String kind,
        Integer register,
        String q,
        String sort,
        int limit) {

    public static ReportFilterParams of(
            String store,
            LocalDate from,
            LocalDate to,
            boolean byDay,
            String format) {
        return new ReportFilterParams(store, from, to, byDay, format, null, null, null, false, null, null, null, null, 500);
    }
}
