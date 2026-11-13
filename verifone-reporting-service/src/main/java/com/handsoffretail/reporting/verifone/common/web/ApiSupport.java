package com.handsoffretail.reporting.verifone.common.web;

import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

public final class ApiSupport {

    private ApiSupport() {
    }

    public static final String FILTERS = """
            (cast(:store as text) is null or store_code = :store)
            and (cast(:from as date) is null or business_date >= :from)
            and (cast(:to as date) is null or business_date <= :to)""";

    public static MapSqlParameterSource params(String store, LocalDate from, LocalDate to) {
        return new MapSqlParameterSource()
                .addValue("store", blankToNull(store))
                .addValue("from", from)
                .addValue("to", to);
    }

    public static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    public static List<Map<String, Object>> clean(List<Map<String, Object>> rows) {
        if (rows == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new java.util.ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            Map<String, Object> mutable = new LinkedHashMap<>(r);
            mutable.replaceAll((k, v) -> v instanceof Timestamp ts ? ts.toLocalDateTime()
                    : v instanceof Date d ? d.toLocalDate() : v);
            result.add(mutable);
        }
        return result;
    }

    public static Map<String, Object> clean(Map<String, Object> row) {
        if (row == null) {
            return Map.of();
        }
        Map<String, Object> mutable = new LinkedHashMap<>(row);
        mutable.replaceAll((k, v) -> v instanceof Timestamp ts ? ts.toLocalDateTime()
                    : v instanceof Date d ? d.toLocalDate() : v);
        return mutable;
    }

    public static ResponseEntity<?> respond(List<Map<String, Object>> rows, String format, String name) {
        List<Map<String, Object>> cleaned = clean(rows);
        if (!"csv".equalsIgnoreCase(format)) {
            return ResponseEntity.ok(cleaned);
        }
        StringBuilder sb = new StringBuilder("\uFEFF"); // BOM so Excel reads UTF-8
        if (!cleaned.isEmpty()) {
            sb.append(String.join(",", cleaned.get(0).keySet().stream().map(ApiSupport::csv).toList())).append("\r\n");
            for (Map<String, Object> r : cleaned) {
                sb.append(String.join(",", r.values().stream().map(v -> csv(v == null ? "" : v.toString())).toList()))
                        .append("\r\n");
            }
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(sb.toString());
    }

    private static String csv(String s) {
        return s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")
                ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }

    public static String orderBy(String sort, Map<String, String> allowed, String fallback) {
        String col = allowed.get(sort == null ? "" : sort);
        return col == null ? fallback : col;
    }

    public static Map<String, String> sorts(String... pairs) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            m.put(pairs[i], pairs[i + 1]);
        }
        return m;
    }
}
