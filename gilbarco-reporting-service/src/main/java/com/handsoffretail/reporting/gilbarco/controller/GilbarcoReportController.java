package com.handsoffretail.reporting.gilbarco.controller;

import static com.handsoffretail.reporting.gilbarco.common.web.ApiSupport.respond;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.gilbarco.common.dto.DailyRegisterRecord;
import com.handsoffretail.reporting.gilbarco.common.dto.DailyRegisterSummaryResponse;
import com.handsoffretail.reporting.gilbarco.common.dto.DepartmentMonthlyRow;
import com.handsoffretail.reporting.gilbarco.common.dto.MonthlyCseReportResponse;
import com.handsoffretail.reporting.gilbarco.common.dto.ReportFilterParams;
import com.handsoffretail.reporting.gilbarco.common.dto.StoreDateRangeDto;
import com.handsoffretail.reporting.gilbarco.pjr.service.GilbarcoPjrReportService;
import com.handsoffretail.reporting.gilbarco.security.StoreSecurityService;
import com.handsoffretail.reporting.gilbarco.stores.model.PosVendor;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import com.handsoffretail.reporting.gilbarco.stores.service.StoreDirectoryService;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class GilbarcoReportController {

    private final StoreDirectoryService storeDirectoryService;
    private final StoreSecurityService storeSecurityService;
    private final GilbarcoPjrReportService reportService;

    public GilbarcoReportController(
            StoreDirectoryService storeDirectoryService,
            StoreSecurityService storeSecurityService,
            GilbarcoPjrReportService reportService) {
        this.storeDirectoryService = storeDirectoryService;
        this.storeSecurityService = storeSecurityService;
        this.reportService = reportService;
    }

    private StoreRecord resolveAndValidate(HorPrincipal principal, String storeCodeOrId) {
        StoreRecord store = storeDirectoryService.resolveStore(storeCodeOrId);
        storeSecurityService.validateAccess(principal, store.storeId());
        if (store.posVendor() != PosVendor.GILBARCO) {
            throw new DomainException(CommonErrorCode.NOT_FOUND, "Store not found.");
        }
        return store;
    }

    private List<StoreRecord> getAccessibleGilbarcoStores(HorPrincipal principal) {
        List<StoreRecord> allStores = storeDirectoryService.getAllStores();
        return storeSecurityService.filterAccessibleStores(principal, allStores).stream()
                .filter(s -> s.posVendor() == PosVendor.GILBARCO)
                .toList();
    }

    @GetMapping("/api/reporting/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "service", "gilbarco-reporting-service",
                "status", "UP",
                "version", "0.1.0"));
    }

    @GetMapping("/api/reports/stores")
    public ResponseEntity<List<StoreRecord>> stores(@AuthenticationPrincipal Jwt jwt) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        return ResponseEntity.ok(getAccessibleGilbarcoStores(principal));
    }

    @GetMapping("/api/reports/date-range")
    public ResponseEntity<List<StoreDateRangeDto>> dateRange(@AuthenticationPrincipal Jwt jwt) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        if (accessible.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<String> codes = accessible.stream().map(StoreRecord::storeCode).toList();
        List<Map<String, Object>> ranges = reportService.getDateRanges(codes);

        List<StoreDateRangeDto> dtos = new ArrayList<>();
        for (StoreRecord store : accessible) {
            Map<String, Object> match = ranges.stream()
                    .filter(r -> store.storeCode().equals(r.get("store_code")))
                    .findFirst()
                    .orElse(null);

            LocalDate firstDay = null;
            LocalDate lastDay = null;
            long files = 0;

            if (match != null) {
                firstDay = toLocalDate(match.get("first_day"));
                lastDay = toLocalDate(match.get("last_day"));
                Object f = match.get("files");
                files = f instanceof Number n ? n.longValue() : 0;
            }

            dtos.add(new StoreDateRangeDto(
                    store.storeId(),
                    store.storeCode(),
                    store.storeName(),
                    store.posVendor().name(),
                    firstDay,
                    lastDay,
                    files));
        }
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/api/reports/day-summary")
    public ResponseEntity<?> daySummary(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getDaySummary(resolvedParams), format, "day-summary");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getDaySummary(resolvedParams));
        }
        return respond(combined, format, "day-summary");
    }

    @GetMapping({"/api/v1/reports/daily-register", "/api/reports/daily-register"})
    public ResponseEntity<?> dailyRegister(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        StoreRecord storeRec = resolveAndValidate(principal, store);
        LocalDate start = date != null ? date : (from != null ? from : LocalDate.now().minusDays(30));
        LocalDate end = date != null ? date : (to != null ? to : LocalDate.now());
        DailyRegisterSummaryResponse summary = reportService.getDailyRegisterSummary(storeRec.storeCode(), storeRec.storeName(), start, end);
        if ("csv".equalsIgnoreCase(format)) {
            StringBuilder sb = new StringBuilder("\uFEFF");
            sb.append("Report Date,Grocery Total,Volume,Cash Deposit,Check Deposit,No Sale,Line Void,Void Amount,Refunds\r\n");
            for (DailyRegisterRecord r : summary.records()) {
                sb.append(r.reportDate()).append(",")
                        .append(r.groceryTotal()).append(",")
                        .append(r.volume()).append(",")
                        .append(r.cashDeposit() == null ? "" : r.cashDeposit()).append(",")
                        .append(r.checkDeposit() == null ? "" : r.checkDeposit()).append(",")
                        .append(r.noSale()).append(",")
                        .append(r.lineVoid()).append(",")
                        .append(r.voidAmount()).append(",")
                        .append(r.refunds()).append("\r\n");
            }
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"daily_register_" + storeRec.storeCode() + ".csv\"")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(sb.toString());
        }
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/api/reports/items-sold")
    public ResponseEntity<?> itemsSold(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer dept,
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean byDay,
            @RequestParam(defaultValue = "net_sales") String sort,
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = new ReportFilterParams(store, from, to, byDay, format, dept, itemType, null, false, null, null, q, sort, limit);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getItemsSold(resolvedParams), format, "items-sold");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getItemsSold(resolvedParams));
        }
        return respond(combined, format, "items-sold");
    }

    @GetMapping("/api/reports/departments")
    public ResponseEntity<?> departments(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String salesClass,
            @RequestParam(defaultValue = "false") boolean byDay,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = new ReportFilterParams(store, from, to, byDay, format, null, null, salesClass, false, null, null, null, null, 500);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getDepartments(resolvedParams), format, "departments");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getDepartments(resolvedParams));
        }
        return respond(combined, format, "departments");
    }

    @GetMapping({"/api/v1/reports/departments/monthly", "/api/reports/departments/monthly"})
    public ResponseEntity<?> monthlyCseReport(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String store,
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        StoreRecord storeRec = resolveAndValidate(principal, store);
        MonthlyCseReportResponse report = reportService.getMonthlyCseReport(storeRec.storeCode(), storeRec.storeName(), month, year);
        if ("csv".equalsIgnoreCase(format)) {
            StringBuilder sb = new StringBuilder("\uFEFF");
            sb.append("Department,Dept ID,Sales Class,Gross,Discount,Promotion,Refund,Void,Net Sales\r\n");
            for (DepartmentMonthlyRow d : report.departments()) {
                sb.append("\"").append(d.deptName().replace("\"", "\"\"")).append("\",")
                        .append(d.deptCode()).append(",")
                        .append(d.salesClass()).append(",")
                        .append(d.gross()).append(",")
                        .append(d.discount()).append(",")
                        .append(d.promotion()).append(",")
                        .append(d.refund()).append(",")
                        .append(d.voidAmount()).append(",")
                        .append(d.netSales()).append("\r\n");
            }
            // one total line per sales class: lottery and fuel are never added into merchandise
            report.classTotals().forEach((cls, t) -> sb.append("TOTAL,,").append(cls).append(",")
                    .append(t.grossTotal()).append(",")
                    .append(t.discountTotal()).append(",")
                    .append(t.promotionTotal()).append(",")
                    .append(t.refundTotal()).append(",")
                    .append(t.voidTotal()).append(",")
                    .append(t.netSalesTotal()).append("\r\n"));

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"monthly_" + month + "_" + year + ".csv\"")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(sb.toString());
        }
        return ResponseEntity.ok(report);
    }

    @GetMapping("/api/reports/fuel")
    public ResponseEntity<?> fuel(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean byDay,
            @RequestParam(defaultValue = "false") boolean byPriceLevel,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = new ReportFilterParams(store, from, to, byDay, format, null, null, null, byPriceLevel, null, null, null, null, 500);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getFuel(resolvedParams), format, "fuel");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getFuel(resolvedParams));
        }
        return respond(combined, format, "fuel");
    }

    @GetMapping("/api/reports/payments")
    public ResponseEntity<?> payments(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean byDay,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, byDay, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getPayments(resolvedParams), format, "payments");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getPayments(resolvedParams));
        }
        return respond(combined, format, "payments");
    }

    @GetMapping("/api/reports/cash-movements")
    public ResponseEntity<?> cashMovements(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = new ReportFilterParams(store, from, to, false, format, null, null, null, false, kind, null, null, null, 500);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getCashMovements(resolvedParams), format, "cash-movements");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getCashMovements(resolvedParams));
        }
        return respond(combined, format, "cash-movements");
    }

    @GetMapping("/api/reports/suspicious/events")
    public ResponseEntity<?> suspiciousEvents(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) Integer register,
            @RequestParam(defaultValue = "5000") int limit,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = new ReportFilterParams(store, from, to, false, format, null, null, null, false, kind, register, null, null, limit);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getSuspiciousEvents(resolvedParams), format, "suspicious-events");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getSuspiciousEvents(resolvedParams));
        }
        return respond(combined, format, "suspicious-events");
    }

    @GetMapping("/api/reports/suspicious/daily")
    public ResponseEntity<?> suspiciousDaily(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getSuspiciousDaily(resolvedParams), format, "suspicious-daily");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getSuspiciousDaily(resolvedParams));
        }
        return respond(combined, format, "suspicious-daily");
    }

    @GetMapping("/api/reports/lottery")
    public ResponseEntity<?> lottery(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getLottery(resolvedParams), format, "lottery");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getLottery(resolvedParams));
        }
        return respond(combined, format, "lottery");
    }

    @GetMapping("/api/reports/lottery-payouts")
    public ResponseEntity<?> lotteryPayouts(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getLotteryPayouts(resolvedParams), format, "lottery-payouts");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getLotteryPayouts(resolvedParams));
        }
        return respond(combined, format, "lottery-payouts");
    }

    @GetMapping("/api/reports/voids")
    public ResponseEntity<?> voids(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getVoids(resolvedParams), format, "voids");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getVoids(resolvedParams));
        }
        return respond(combined, format, "voids");
    }

    @GetMapping("/api/reports/payment-gaps")
    public ResponseEntity<?> paymentGaps(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String store,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        ReportFilterParams p = ReportFilterParams.of(store, from, to, false, format);

        if (p.store() != null && !p.store().isBlank()) {
            StoreRecord storeRec = resolveAndValidate(principal, p.store());
            ReportFilterParams resolvedParams = withStoreCode(p, storeRec.storeCode());
            return respond(reportService.getPaymentGaps(resolvedParams), format, "payment-gaps");
        }

        List<StoreRecord> accessible = getAccessibleGilbarcoStores(principal);
        List<Map<String, Object>> combined = new ArrayList<>();
        for (StoreRecord s : accessible) {
            ReportFilterParams resolvedParams = withStoreCode(p, s.storeCode());
            combined.addAll(reportService.getPaymentGaps(resolvedParams));
        }
        return respond(combined, format, "payment-gaps");
    }

    @GetMapping("/api/events/{fileId}")
    public ResponseEntity<Map<String, Object>> gilbarcoEvent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long fileId,
            @RequestParam(required = false) String store) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        if (store != null && !store.isBlank()) {
            resolveAndValidate(principal, store);
            return reportService.getEventDetail(fileId)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        }

        Optional<Map<String, Object>> event = reportService.getEventDetail(fileId);
        if (event.isPresent()) {
            Object storeCode = event.get().get("store_code");
            if (storeCode != null) {
                resolveAndValidate(principal, storeCode.toString());
            }
            return ResponseEntity.ok(event.get());
        }
        return ResponseEntity.notFound().build();
    }

    private static ReportFilterParams withStoreCode(ReportFilterParams original, String storeCode) {
        return new ReportFilterParams(
                storeCode,
                original.from(),
                original.to(),
                original.byDay(),
                original.format(),
                original.dept(),
                original.itemType(),
                original.salesClass(),
                original.byPriceLevel(),
                original.kind(),
                original.register(),
                original.q(),
                original.sort(),
                original.limit());
    }

    private static LocalDate toLocalDate(Object val) {
        if (val instanceof LocalDate ld) return ld;
        if (val instanceof Date d) return d.toLocalDate();
        if (val instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate();
        if (val instanceof String s && !s.isBlank()) return LocalDate.parse(s.trim());
        return null;
    }
}
