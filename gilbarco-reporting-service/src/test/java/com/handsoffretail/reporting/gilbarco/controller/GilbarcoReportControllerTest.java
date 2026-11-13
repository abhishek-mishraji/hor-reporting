package com.handsoffretail.reporting.gilbarco.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.auth.client.ProblemDetailsAdvice;
import com.handsoffretail.reporting.gilbarco.common.web.DataAccessAdvice;
import com.handsoffretail.reporting.gilbarco.common.dto.CseReportTotals;
import com.handsoffretail.reporting.gilbarco.common.dto.DailyRegisterRecord;
import com.handsoffretail.reporting.gilbarco.common.dto.DailyRegisterSummaryResponse;
import com.handsoffretail.reporting.gilbarco.common.dto.DepartmentMonthlyRow;
import com.handsoffretail.reporting.gilbarco.common.dto.MonthlyCseReportResponse;
import com.handsoffretail.reporting.gilbarco.pjr.service.GilbarcoPjrReportService;
import com.handsoffretail.reporting.gilbarco.security.StoreSecurityService;
import com.handsoffretail.reporting.gilbarco.stores.model.PosVendor;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import com.handsoffretail.reporting.gilbarco.stores.service.StoreDirectoryService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

class GilbarcoReportControllerTest {

    private StoreDirectoryService storeDirectoryService;
    private StoreSecurityService storeSecurityService;
    private GilbarcoPjrReportService reportService;
    private MockMvc mockMvc;

    private final StoreRecord gilbarcoStore = new StoreRecord(1L, "WOLF_800", "Wolf Quick Stop", PosVendor.GILBARCO, "America/Chicago", "ACTIVE");
    private final StoreRecord otherStore = new StoreRecord(2L, "OTHER_8730", "Other Stop", PosVendor.OTHER, "America/New_York", "ACTIVE");

    @BeforeEach
    void setUp() {
        storeDirectoryService = mock(StoreDirectoryService.class);
        storeSecurityService = mock(StoreSecurityService.class);
        reportService = mock(GilbarcoPjrReportService.class);

        GilbarcoReportController controller = new GilbarcoReportController(
                storeDirectoryService, storeSecurityService, reportService);

        HandlerMethodArgumentResolver jwtResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                        && parameter.getParameterType().equals(Jwt.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                    NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return Jwt.withTokenValue("mock-token")
                        .header("alg", "RS256")
                        .subject("1")
                        .claim("typ", "ADMIN")
                        .claim("role", "PLATFORM_ADMIN")
                        .claim("name", "Test Admin")
                        .claim("all_stores", true)
                        .claim("stores", List.of())
                        .build();
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(jwtResolver)
                .setControllerAdvice(new DataAccessAdvice(), new ProblemDetailsAdvice())
                .build();
    }

    @Test
    @DisplayName("GET /api/reporting/status returns 200 UP and service name")
    void statusEndpoint() throws Exception {
        mockMvc.perform(get("/api/reporting/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("gilbarco-reporting-service"));
    }

    @Test
    @DisplayName("GET /api/reports/stores returns only GILBARCO stores")
    void storesEndpoint() throws Exception {
        when(storeDirectoryService.getAllStores()).thenReturn(List.of(gilbarcoStore, otherStore));
        when(storeSecurityService.filterAccessibleStores(any(), any())).thenReturn(List.of(gilbarcoStore, otherStore));

        mockMvc.perform(get("/api/reports/stores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].store_code").value("WOLF_800"))
                .andExpect(jsonPath("$[0].pos_vendor").value("GILBARCO"));
    }

    @Test
    @DisplayName("GET /api/reports/date-range returns date ranges for GILBARCO stores")
    void dateRangeEndpoint() throws Exception {
        when(storeDirectoryService.getAllStores()).thenReturn(List.of(gilbarcoStore, otherStore));
        when(storeSecurityService.filterAccessibleStores(any(), any())).thenReturn(List.of(gilbarcoStore, otherStore));
        when(reportService.getDateRanges(List.of("WOLF_800"))).thenReturn(List.of(
                Map.of("store_code", "WOLF_800", "first_day", "2026-09-22", "last_day", "2026-09-30", "files", 8420)));

        mockMvc.perform(get("/api/reports/date-range"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].store_code").value("WOLF_800"))
                .andExpect(jsonPath("$[0].pos_vendor").value("GILBARCO"))
                .andExpect(jsonPath("$[0].first_day").value("2026-09-22"));
    }

    @Test
    @DisplayName("GET /api/reports/day-summary returns JSON for valid store")
    void daySummaryJson() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);
        when(reportService.getDaySummary(any())).thenReturn(List.of(
                Map.of("store_code", "WOLF_800", "business_date", "2026-09-25", "total_sales_with_tax", 2500.00)));

        mockMvc.perform(get("/api/reports/day-summary?store=WOLF_800&from=2026-09-25&to=2026-09-25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].store_code").value("WOLF_800"))
                .andExpect(jsonPath("$[0].total_sales_with_tax").value(2500.00));
    }

    @Test
    @DisplayName("GET /api/reports/day-summary with format=csv returns CSV attachment")
    void daySummaryCsv() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);
        when(reportService.getDaySummary(any())).thenReturn(List.of(
                Map.of("store_code", "WOLF_800", "business_date", "2026-09-25", "total_sales_with_tax", 2500.00)));

        mockMvc.perform(get("/api/reports/day-summary?store=WOLF_800&format=csv"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"day-summary.csv\""))
                .andExpect(content().string(Matchers.containsString("store_code")))
                .andExpect(content().string(Matchers.containsString("WOLF_800")));
    }

    @Test
    @DisplayName("A store of the other vendor gets 404 (do not leak that it exists)")
    void otherVendorStoreGets404() throws Exception {
        when(storeDirectoryService.resolveStore("OTHER_8730")).thenReturn(otherStore);

        mockMvc.perform(get("/api/reports/day-summary?store=OTHER_8730"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/reports/items-sold returns items sold")
    void itemsSold() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);
        when(reportService.getItemsSold(any())).thenReturn(List.of(
                Map.of("store_code", "WOLF_800", "upc", "01234567890", "net_sales", 150.00)));

        mockMvc.perform(get("/api/reports/items-sold?store=WOLF_800"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].store_code").value("WOLF_800"))
                .andExpect(jsonPath("$[0].upc").value("01234567890"));
    }

    @Test
    @DisplayName("GET /api/reports/payment-gaps returns payment gaps")
    void paymentGaps() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);
        when(reportService.getPaymentGaps(any())).thenReturn(List.of(
                Map.of("store_code", "WOLF_800", "gap_seconds", 42)));

        mockMvc.perform(get("/api/reports/payment-gaps?store=WOLF_800"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].store_code").value("WOLF_800"))
                .andExpect(jsonPath("$[0].gap_seconds").value(42));
    }

    @Test
    @DisplayName("GET /api/events/{fileId} returns event detail")
    void eventDetailFound() throws Exception {
        when(reportService.getEventDetail(500L))
                .thenReturn(Optional.of(Map.of("file_id", 500, "transaction_id", 841, "total_grand", 62.40, "store_code", "WOLF_800")));
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);

        mockMvc.perform(get("/api/events/500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.file_id").value(500))
                .andExpect(jsonPath("$.transaction_id").value(841))
                .andExpect(jsonPath("$.total_grand").value(62.40));
    }

    @Test
    @DisplayName("GET /api/events/{fileId} returns 404 when event not found")
    void eventDetailNotFound() throws Exception {
        when(reportService.getEventDetail(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/events/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/v1/reports/departments/monthly returns CSE monthly department report")
    void monthlyCseReportJson() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);

        DepartmentMonthlyRow row = new DepartmentMonthlyRow(
                3, "Beer", "merchandise", BigDecimal.valueOf(11586.06), BigDecimal.valueOf(0.34),
                BigDecimal.valueOf(445.06), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(11140.66));
        CseReportTotals totals = new CseReportTotals(
                BigDecimal.valueOf(11586.06), BigDecimal.valueOf(0.34),
                BigDecimal.valueOf(445.06), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(11140.66));
        MonthlyCseReportResponse resp = new MonthlyCseReportResponse(
                "WOLF_800", "Wolf Quick Stop", 8, 2026, "GILBARCO_PJR", List.of(row), totals,
                Map.of("merchandise", totals));

        when(reportService.getMonthlyCseReport("WOLF_800", "Wolf Quick Stop", 8, 2026)).thenReturn(resp);

        mockMvc.perform(get("/api/v1/reports/departments/monthly?store=WOLF_800&month=8&year=2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeCode").value("WOLF_800"))
                .andExpect(jsonPath("$.departments[0].deptName").value("Beer"))
                .andExpect(jsonPath("$.departments[0].salesClass").value("merchandise"))
                .andExpect(jsonPath("$.totals.netSalesTotal").value(11140.66))
                .andExpect(jsonPath("$.classTotals.merchandise.netSalesTotal").value(11140.66));
    }

    @Test
    @DisplayName("GET /api/v1/reports/daily-register CSV leaves deposits blank when POS has no safe-drop tender")
    void dailyRegisterCsvBlankDeposits() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);

        DailyRegisterRecord record = new DailyRegisterRecord(
                LocalDate.of(2026, 10, 15), BigDecimal.valueOf(2100.00),
                BigDecimal.valueOf(900.00), null, null,
                3L, 7L, BigDecimal.valueOf(40.00), BigDecimal.valueOf(5.00));
        DailyRegisterSummaryResponse resp = new DailyRegisterSummaryResponse(
                "WOLF_800", "Wolf Quick Stop", "GILBARCO_PJR", List.of(record));

        when(reportService.getDailyRegisterSummary(any(), any(), any(), any())).thenReturn(resp);

        mockMvc.perform(get("/api/v1/reports/daily-register?store=WOLF_800&date=2026-10-15&format=csv"))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString(
                        "Report Date,Grocery Total,Volume,Cash Deposit,Check Deposit,No Sale,Line Void,Void Amount,Refunds")))
                .andExpect(content().string(Matchers.containsString("2026-10-15,2100.0,900.0,,,3,7,40.0,5.0")));
    }

    @Test
    @DisplayName("A report database error answers 503 DATA_UNAVAILABLE, not an empty list")
    void reportDatabaseErrorIs503() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(gilbarcoStore);
        when(reportService.getDaySummary(any())).thenThrow(new DataAccessResourceFailureException("connection refused"));

        mockMvc.perform(get("/api/reports/day-summary?store=WOLF_800"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATA_UNAVAILABLE"));
    }

    @Test
    @DisplayName("A store lookup (auth_db) error answers 503, not 404 Store not found")
    void storeLookupDatabaseErrorIs503() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenThrow(new DataAccessResourceFailureException("auth_db down"));

        mockMvc.perform(get("/api/reports/day-summary?store=WOLF_800"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATA_UNAVAILABLE"));
    }
}