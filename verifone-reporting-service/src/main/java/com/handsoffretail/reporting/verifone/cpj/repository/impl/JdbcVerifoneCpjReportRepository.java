package com.handsoffretail.reporting.verifone.cpj.repository.impl;

import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.FILTERS;
import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.blankToNull;
import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.clean;
import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.orderBy;
import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.params;
import static com.handsoffretail.reporting.verifone.common.web.ApiSupport.sorts;

import com.handsoffretail.reporting.verifone.common.dto.CseReportTotals;
import com.handsoffretail.reporting.verifone.common.dto.DailyRegisterRecord;
import com.handsoffretail.reporting.verifone.common.dto.DailyRegisterSummaryResponse;
import com.handsoffretail.reporting.verifone.common.dto.DepartmentMonthlyRow;
import com.handsoffretail.reporting.verifone.common.dto.MonthlyCseReportResponse;
import com.handsoffretail.reporting.verifone.common.dto.ReportFilterParams;
import com.handsoffretail.reporting.verifone.cpj.repository.VerifoneCpjReportRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads verifone_db through the report.rpt_* views (verifone-ingestion-service V3).
 * Every figure is computed from the CPJ files.
 */
@Repository
public class JdbcVerifoneCpjReportRepository implements VerifoneCpjReportRepository {

    private static final int MAX_ROWS = 20_000;

    private final NamedParameterJdbcTemplate db;
    private final JdbcTemplate jdbc;

    public JdbcVerifoneCpjReportRepository(
            @Qualifier("verifoneJdbcTemplate") NamedParameterJdbcTemplate db,
            @Qualifier("verifoneSimpleJdbc") JdbcTemplate jdbc) {
        this.db = db;
        this.jdbc = jdbc;
    }

    private List<Map<String, Object>> query(String sql, MapSqlParameterSource p) {
        return db.queryForList(sql, p);
    }

    @Override
    public List<Map<String, Object>> getDaySummary(ReportFilterParams p) {
        // The view already counts no_sales / void_lines / voids / refunds / refund_voids; add the dollar amounts
        // (positive): voided lines, whole-ticket voids (before tax) and refund lines.
        String sql = """
                SELECT d.*,
                       coalesce(v.void_line_amount, 0) AS void_line_amount,
                       coalesce(v.void_amount, 0) AS void_amount,
                       coalesce(v.total_void_amount, 0) AS total_void_amount,
                       coalesce(r.refund_amount, 0) AS refund_amount
                FROM (SELECT * FROM report.rpt_day_summary WHERE """ + FILTERS + """
                ) d
                LEFT JOIN report.rpt_void_daily v ON v.store_id = d.store_id AND v.business_date = d.business_date
                LEFT JOIN (
                    SELECT store_id, business_date, -sum(amount) AS refund_amount
                    FROM report.rpt_suspicious_daily
                    WHERE kind = 'refund' AND """ + FILTERS + """
                    GROUP BY store_id, business_date
                ) r ON r.store_id = d.store_id AND r.business_date = d.business_date
                ORDER BY d.store_code, d.business_date""";
        return query(sql, params(p.store(), p.from(), p.to()));
    }

    @Override
    public List<Map<String, Object>> getItemsSold(ReportFilterParams filter) {
        int limit = Math.max(1, Math.min(filter.limit(), MAX_ROWS));
        MapSqlParameterSource p = params(filter.store(), filter.from(), filter.to())
                .addValue("dept", filter.dept())
                .addValue("q", blankToNull(filter.q()))
                .addValue("itemType", blankToNull(filter.itemType()))
                .addValue("limit", limit);

        String where = FILTERS + """
                 AND (cast(:dept AS integer) IS NULL OR dept_number = :dept)
                 AND (cast(:itemType AS text) IS NULL OR item_type = :itemType)
                 AND (cast(:q AS text) IS NULL OR upc ILIKE '%' || :q || '%' OR description ILIKE '%' || :q || '%')""";

        String order = orderBy(filter.sort(), sorts(
                "net_sales", "net_sales desc",
                "units_sold", "units_sold desc",
                "gross_sales", "gross_sales desc",
                "tickets", "tickets desc",
                "description", "description",
                "upc", "upc"), "net_sales desc");

        String sql = filter.byDay()
                ? "SELECT * FROM report.rpt_items_sold_daily WHERE " + where + " ORDER BY business_date, " + order + " LIMIT :limit"
                : "SELECT store_code, item_type, upc, max(description) AS description, dept_number, max(dept_name) AS dept_name, "
                  + "sales_class, sum(units_sold) AS units_sold, sum(gross_sales) AS gross_sales, "
                  + "sum(promotions) AS promotions, sum(net_sales) AS net_sales, sum(tickets) AS tickets, "
                  + "count(distinct business_date) AS days "
                  + "FROM report.rpt_items_sold_daily WHERE " + where + " "
                  + "GROUP BY store_code, item_type, upc, dept_number, sales_class "
                  + "ORDER BY " + order + " LIMIT :limit";

        return query(sql, p);
    }

    @Override
    public List<Map<String, Object>> getDepartments(ReportFilterParams filter) {
        MapSqlParameterSource p = params(filter.store(), filter.from(), filter.to())
                .addValue("cls", blankToNull(filter.salesClass()));
        String where = FILTERS + " AND (cast(:cls AS text) IS NULL OR sales_class = :cls)";

        String sql = filter.byDay()
                ? "SELECT * FROM report.rpt_department_daily WHERE " + where + " ORDER BY business_date, net_sales DESC"
                : "SELECT store_code, dept_number, max(dept_name) AS dept_name, sales_class, sum(units_sold) AS units_sold, "
                  + "sum(gross_sales) AS gross_sales, sum(promotions) AS promotions, sum(net_sales) AS net_sales, "
                  + "sum(fuel_gallons) AS fuel_gallons, sum(lines) AS lines "
                  + "FROM report.rpt_department_daily WHERE " + where + " "
                  + "GROUP BY store_code, dept_number, sales_class ORDER BY net_sales DESC";

        return query(sql, p);
    }

    @Override
    public List<Map<String, Object>> getFuel(ReportFilterParams filter) {
        String keys = "store_code" + (filter.byDay() ? ", business_date" : "") + ", fuel_grade" + (filter.byPriceLevel() ? ", fuel_price_level" : "");
        String sql = "SELECT " + keys + ", sum(gallons) AS gallons, sum(amount) AS amount, sum(fuel_sales) AS fuel_sales, "
                + "sum(ppg_discount) AS ppg_discount, round(sum(amount) / nullif(sum(gallons), 0), 3) AS avg_price "
                + "FROM report.rpt_fuel_daily WHERE " + FILTERS + " GROUP BY " + keys + " ORDER BY " + keys;
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getPayments(ReportFilterParams filter) {
        String keys = "store_code" + (filter.byDay() ? ", business_date" : "") + ", payment_type";
        String sql = "SELECT " + keys + ", sum(payments) AS payments, sum(sales_amount) AS sales_amount, "
                + "sum(refunds) AS refunds, sum(refunded_amount) AS refunded_amount, sum(net_amount) AS net_amount "
                + "FROM report.rpt_payment_daily WHERE " + FILTERS + " GROUP BY " + keys + " ORDER BY "
                + (filter.byDay() ? "store_code, business_date, " : "store_code, ") + "sales_amount DESC";
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getCashMovements(ReportFilterParams filter) {
        MapSqlParameterSource p = params(filter.store(), filter.from(), filter.to())
                .addValue("kind", blankToNull(filter.kind()));
        String sql = "SELECT * FROM report.rpt_cash_movement WHERE " + FILTERS
                + " AND (cast(:kind AS text) IS NULL OR kind = :kind) ORDER BY occurred_at";
        return query(sql, p);
    }

    @Override
    public List<Map<String, Object>> getSuspiciousEvents(ReportFilterParams filter) {
        int limit = Math.max(1, Math.min(filter.limit(), MAX_ROWS));
        MapSqlParameterSource p = params(filter.store(), filter.from(), filter.to())
                .addValue("kind", blankToNull(filter.kind()))
                .addValue("register", filter.register())
                .addValue("limit", limit);
        String sql = "SELECT * FROM report.rpt_suspicious_event WHERE " + FILTERS
                + " AND (cast(:kind AS text) IS NULL OR kind = :kind)"
                + " AND (cast(:register AS integer) IS NULL OR register = :register)"
                + " ORDER BY occurred_at, ticket_number LIMIT :limit";
        return query(sql, p);
    }

    @Override
    public List<Map<String, Object>> getSuspiciousDaily(ReportFilterParams filter) {
        String sql = "SELECT * FROM report.rpt_suspicious_daily WHERE " + FILTERS
                + " ORDER BY store_code, business_date, kind";
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getLottery(ReportFilterParams filter) {
        String sql = "SELECT * FROM report.rpt_lottery_daily WHERE " + FILTERS + " ORDER BY store_code, business_date";
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getLotteryPayouts(ReportFilterParams filter) {
        String sql = "SELECT * FROM report.rpt_lottery_payout_daily WHERE " + FILTERS + " ORDER BY store_code, business_date";
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getVoids(ReportFilterParams filter) {
        String sql = "SELECT * FROM report.rpt_void_daily WHERE " + FILTERS + " ORDER BY store_code, business_date";
        return query(sql, params(filter.store(), filter.from(), filter.to()));
    }

    @Override
    public List<Map<String, Object>> getDateRanges(List<String> storeCodes) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = "";
        if (storeCodes != null && !storeCodes.isEmpty()) {
            p.addValue("stores", storeCodes);
            where = " WHERE s.store_code IN (:stores)";
        }
        String sql = "SELECT s.store_code, min(f.business_date) AS first_day, max(f.business_date) AS last_day, count(*) AS files "
                + "FROM cpj.cpj_files f JOIN master.stores s ON s.store_id = f.store_id"
                + where + " GROUP BY s.store_code ORDER BY s.store_code";
        return query(sql, p);
    }

    @Override
    public Optional<Map<String, Object>> getTicketDetail(long fileId, int ticketSeq) {
        List<Map<String, Object>> head = jdbc.queryForList(
                "SELECT * FROM report.rpt_ticket WHERE file_id = ? AND ticket_seq = ?", fileId, ticketSeq);
        if (head.isEmpty()) {
            return Optional.empty();
        }
        long ticketId = ((Number) head.get(0).get("ticket_id")).longValue();

        Map<String, Object> out = new LinkedHashMap<>(clean(head.get(0)));
        out.put("lines", clean(jdbc.queryForList(
                "SELECT * FROM report.rpt_ticket_line WHERE ticket_id = ? ORDER BY line_no", ticketId)));
        out.put("payments", clean(jdbc.queryForList(
                "SELECT * FROM report.rpt_payment_line WHERE ticket_id = ? ORDER BY line_no", ticketId)));
        out.put("taxes", clean(jdbc.queryForList(
                "SELECT * FROM report.rpt_ticket_tax WHERE ticket_id = ? ORDER BY tax_sysid", ticketId)));

        // Prepay deposit / completion and recalled tickets
        out.put("related", clean(jdbc.queryForList("""
                SELECT r.file_id, r.ticket_seq, r.trans_type, r.tr_seq, r.ticket_local, r.total,
                       r.is_suspended, r.is_fuel_prepay, r.is_rollback, r.is_prepay_completion
                FROM report.rpt_ticket t JOIN report.rpt_ticket r ON r.store_id = t.store_id
                 AND ((r.pos_num = t.orig_pos_num AND r.tr_seq = t.orig_tr_seq)
                   OR (r.pos_num = t.recall_pos_num AND r.tr_seq = t.recall_tr_seq)
                   OR (t.pos_num = r.orig_pos_num AND t.tr_seq = r.orig_tr_seq)
                   OR (t.pos_num = r.pos_num AND t.tr_seq = r.tr_seq AND r.ticket_id <> t.ticket_id))
                 AND r.business_date BETWEEN t.business_date - 1 AND t.business_date + 1
                WHERE t.ticket_id = ?
                ORDER BY r.ticket_local""", ticketId)));

        return Optional.of(out);
    }

    @Override
    public MonthlyCseReportResponse getMonthlyCseReport(String storeCode, String storeName, int month, int year) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.plusMonths(1).minusDays(1);
        MapSqlParameterSource p = params(storeCode, from, to);

        // gross_sales is after refunds and void lines (both are negative lines), so add them back:
        // gross - refund - void - promotion = net. discount is already inside the line totals.
        String sql = """
                SELECT dept_number,
                       coalesce(sales_class, 'other') AS sales_class,
                       coalesce(max(dept_name), 'Dept ' || dept_number) AS dept_name,
                       coalesce(sum(gross_sales) + sum(refund) + sum(void_amount), 0) AS gross,
                       coalesce(sum(discount), 0) AS discount,
                       coalesce(sum(promotions), 0) AS promotion,
                       coalesce(sum(refund), 0) AS refund,
                       coalesce(sum(void_amount), 0) AS void_amount,
                       coalesce(sum(net_sales), 0) AS net_sales
                FROM report.rpt_department_daily
                WHERE """ + FILTERS + """
                GROUP BY dept_number, coalesce(sales_class, 'other')
                ORDER BY CASE coalesce(sales_class, 'other') WHEN 'merchandise' THEN 0 WHEN 'lottery_sale' THEN 1
                              WHEN 'lottery_payout' THEN 2 WHEN 'fuel' THEN 3 ELSE 4 END,
                         max(dept_name) ASC""";

        List<Map<String, Object>> rows = query(sql, p);
        List<DepartmentMonthlyRow> depts = new ArrayList<>();
        Map<String, List<DepartmentMonthlyRow>> byClass = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            int deptCode = ((Number) r.getOrDefault("dept_number", 0)).intValue();
            String name = (String) r.getOrDefault("dept_name", "Dept " + deptCode);
            String salesClass = (String) r.get("sales_class");
            DepartmentMonthlyRow row = new DepartmentMonthlyRow(deptCode, name, salesClass,
                    bd(r.get("gross")), bd(r.get("discount")), bd(r.get("promotion")),
                    bd(r.get("refund")), bd(r.get("void_amount")), bd(r.get("net_sales")));
            depts.add(row);
            byClass.computeIfAbsent(salesClass, k -> new ArrayList<>()).add(row);
        }

        Map<String, CseReportTotals> classTotals = new LinkedHashMap<>();
        byClass.forEach((cls, list) -> classTotals.put(cls, CseReportTotals.sum(list)));
        CseReportTotals totals = CseReportTotals.sum(byClass.getOrDefault("merchandise", List.of()));

        return new MonthlyCseReportResponse(storeCode, storeName, month, year, "VERIFONE_CPJ", depts, totals, classTotals);
    }

    @Override
    public DailyRegisterSummaryResponse getDailyRegisterSummary(String storeCode, String storeName, LocalDate from, LocalDate to) {
        MapSqlParameterSource p = params(storeCode, from, to);

        // cash / check deposit = safe drops paid in cash / check (the safe drop's payment lines)
        String sql = """
                SELECT d.business_date,
                       coalesce(d.merchandise_net, 0) AS grocery_total,
                       coalesce(d.fuel_gallons, 0) AS volume,
                       coalesce(d.cash_deposit, 0) AS cash_deposit,
                       coalesce(d.check_deposit, 0) AS check_deposit,
                       coalesce(s.no_sale_count, 0) AS no_sale,
                       coalesce(v.void_lines, 0) AS line_void,
                       coalesce(v.void_amount, 0) AS void_amount,
                       coalesce(s.refund_amount, 0) AS refunds
                FROM (SELECT * FROM report.rpt_day_summary WHERE """ + FILTERS + """
                ) d
                LEFT JOIN (
                    SELECT business_date,
                           coalesce(sum(occurrences) FILTER (WHERE kind = 'no_sale'), 0) AS no_sale_count,
                           coalesce(-sum(amount) FILTER (WHERE kind = 'refund'), 0) AS refund_amount
                    FROM report.rpt_suspicious_daily
                    WHERE """ + FILTERS + """
                    GROUP BY business_date
                ) s ON s.business_date = d.business_date
                LEFT JOIN (
                    SELECT business_date,
                           coalesce(sum(void_lines), 0) AS void_lines,
                           coalesce(sum(total_void_amount), 0) AS void_amount
                    FROM report.rpt_void_daily
                    WHERE """ + FILTERS + """
                    GROUP BY business_date
                ) v ON v.business_date = d.business_date
                ORDER BY d.business_date ASC""";

        List<Map<String, Object>> rows = query(sql, p);
        List<DailyRegisterRecord> records = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            LocalDate date = toDate(r.get("business_date"));
            BigDecimal grocery = bd(r.get("grocery_total"));
            BigDecimal volume = bd(r.get("volume"));
            BigDecimal cash = bd(r.get("cash_deposit"));
            BigDecimal check = bd(r.get("check_deposit"));
            long noSale = toLong(r.get("no_sale"));
            long lineVoid = toLong(r.get("line_void"));
            BigDecimal voidAmt = bd(r.get("void_amount"));
            BigDecimal refunds = bd(r.get("refunds"));

            records.add(new DailyRegisterRecord(date, grocery, volume, cash, check, noSale, lineVoid, voidAmt, refunds));
        }

        return new DailyRegisterSummaryResponse(storeCode, storeName, "VERIFONE_CPJ", records);
    }

    private static BigDecimal bd(Object val) {
        if (val == null) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (val instanceof BigDecimal b) return b.setScale(2, RoundingMode.HALF_UP);
        if (val instanceof Number n) return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        try {
            return new BigDecimal(val.toString().trim()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    private static long toLong(Object val) {
        if (val == null) return 0L;
        if (val instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(val.toString().trim());
        } catch (Exception e) {
            return 0L;
        }
    }

    private static LocalDate toDate(Object val) {
        if (val instanceof LocalDate ld) return ld;
        if (val instanceof java.sql.Date d) return d.toLocalDate();
        if (val != null) {
            try { return LocalDate.parse(val.toString().substring(0, 10)); } catch (Exception ignored) {}
        }
        return LocalDate.now();
    }
}
