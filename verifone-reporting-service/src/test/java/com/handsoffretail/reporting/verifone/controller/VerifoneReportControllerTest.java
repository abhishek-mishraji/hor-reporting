package com.handsoffretail.reporting.verifone.controller;

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
import com.handsoffretail.reporting.verifone.common.web.DataAccessAdvice;
import com.handsoffretail.reporting.verifone.common.dto.CseReportTotals;
import com.handsoffretail.reporting.verifone.common.dto.DailyRegisterRecord;
import com.handsoffretail.reporting.verifone.common.dto.DailyRegisterSummaryResponse;
import com.handsoffretail.reporting.verifone.common.dto.DepartmentMonthlyRow;
import com.handsoffretail.reporting.verifone.common.dto.MonthlyCseReportResponse;
import com.handsoffretail.reporting.verifone.cpj.service.VerifoneCpjReportService;
import com.handsoffretail.reporting.verifone.security.StoreSecurityService;
import com.handsoffretail.reporting.verifone.stores.model.PosVendor;
import com.handsoffretail.reporting.verifone.stores.model.StoreRecord;
import com.handsoffretail.reporting.verifone.stores.service.StoreDirectoryService;
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

class VerifoneReportControllerTest {

    private StoreDirectoryService storeDirectoryService;
    private StoreSecurityService storeSecurityService;
    private VerifoneCpjReportService reportService;
    private MockMvc mockMvc;

    private final StoreRecord verifoneStore = new StoreRecord(1L, "TIKI_8730", "Tiki Hut", PosVendor.VERIFONE, "America/New_York", "ACTIVE");
    private final StoreRecord otherStore = new StoreRecord(2L, "WOLF_800", "Wolf Quick Stop", PosVendor.OTHER, "America/Chicago", "ACTIVE");

    @BeforeEach
    void setUp() {
        storeDirectoryService = mock(StoreDirectoryService.class);
        storeSecurityService = mock(StoreSecurityService.class);
        reportService = mock(VerifoneCpjReportService.class);

        VerifoneReportController controller = new VerifoneReportController(
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
                .andExpect(jsonPath("$.service").value("verifone-reporting-service"));
    }

    @Test
    @DisplayName("GET /api/reports/stores returns only VERIFONE stores")
    void storesEndpoint() throws Exception {
        when(storeDirectoryService.getAllStores()).thenReturn(List.of(verifoneStore, otherStore));
        when(storeSecurityService.filterAccessibleStores(any(), any())).thenReturn(List.of(verifoneStore, otherStore));

        mockMvc.perform(get("/api/reports/stores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].store_code").value("TIKI_8730"))
                .andExpect(jsonPath("$[0].pos_vendor").value("VERIFONE"));
    }

    @Test
    @DisplayName("GET /api/reports/date-range returns date ranges for VERIFONE stores")
    void dateRangeEndpoint() throws Exception {
        when(storeDirectoryService.getAllStores()).thenReturn(List.of(verifoneStore, otherStore));
        when(storeSecurityService.filterAccessibleStores(any(), any())).thenReturn(List.of(verifoneStore, otherStore));
        when(reportService.getDateRanges(List.of("TIKI_8730"))).thenReturn(List.of(
                Map.of("store_code", "TIKI_8730", "first_day", "2026-09-01", "last_day", "2026-09-30", "files", 30)));

        mockMvc.perform(get("/api/reports/date-range"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].store_code").value("TIKI_8730"))
                .andExpect(jsonPath("$[0].pos_vendor").value("VERIFONE"))
                .andExpect(jsonPath("$[0].first_day").value("2026-09-01"));
    }

    @Test
    @DisplayName("GET /api/reports/day-summary returns JSON for valid store")
    void daySummaryJson() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);
        when(reportService.getDaySummary(any())).thenReturn(List.of(
                Map.of("store_code", "TIKI_8730", "business_date", "2026-09-25", "total_sales_with_tax", 9542.80)));

        mockMvc.perform(get("/api/reports/day-summary?store=TIKI_8730&from=2026-09-25&to=2026-09-25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].store_code").value("TIKI_8730"))
                .andExpect(jsonPath("$[0].total_sales_with_tax").value(9542.80));
    }

    @Test
    @DisplayName("GET /api/reports/day-summary with format=csv returns CSV attachment")
    void daySummaryCsv() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);
        when(reportService.getDaySummary(any())).thenReturn(List.of(
                Map.of("store_code", "TIKI_8730", "business_date", "2026-09-25", "total_sales_with_tax", 9542.80)));

        mockMvc.perform(get("/api/reports/day-summary?store=TIKI_8730&format=csv"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"day-summary.csv\""))
                .andExpect(content().string(Matchers.containsString("store_code")))
                .andExpect(content().string(Matchers.containsString("TIKI_8730")));
    }

    @Test
    @DisplayName("A store of the other vendor gets 404 (do not leak that it exists)")
    void otherVendorStoreGets404() throws Exception {
        when(storeDirectoryService.resolveStore("WOLF_800")).thenReturn(otherStore);

        mockMvc.perform(get("/api/reports/day-summary?store=WOLF_800"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/reports/items-sold returns items sold")
    void itemsSold() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);
        when(reportService.getItemsSold(any())).thenReturn(List.of(
                Map.of("store_code", "TIKI_8730", "upc", "01234567890", "net_sales", 150.00)));

        mockMvc.perform(get("/api/reports/items-sold?store=TIKI_8730"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].store_code").value("TIKI_8730"))
                .andExpect(jsonPath("$[0].upc").value("01234567890"));
    }

    @Test
    @DisplayName("GET /api/tickets/{fileId}/{ticketSeq} returns ticket detail")
    void ticketDetailFound() throws Exception {
        when(reportService.getTicketDetail(1L, 1))
                .thenReturn(Optional.of(Map.of("store_code", "TIKI_8730", "ticket_number", 1234)));
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);

        mockMvc.perform(get("/api/tickets/1/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.store_code").value("TIKI_8730"))
                .andExpect(jsonPath("$.ticket_number").value(1234));
    }

    @Test
    @DisplayName("GET /api/tickets/{fileId}/{ticketSeq} returns 404 when ticket not found")
    void ticketDetailNotFound() throws Exception {
        when(reportService.getTicketDetail(999L, 1)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tickets/999/1"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/v1/reports/departments/monthly returns CSE monthly department report")
    void monthlyCseReportJson() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);

        DepartmentMonthlyRow row = new DepartmentMonthlyRow(
                3, "Beer", "merchandise", BigDecimal.valueOf(11586.06), BigDecimal.valueOf(0.34),
                BigDecimal.valueOf(445.06), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(11140.66));
        CseReportTotals totals = new CseReportTotals(
                BigDecimal.valueOf(11586.06), BigDecimal.valueOf(0.34),
                BigDecimal.valueOf(445.06), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(11140.66));
        MonthlyCseReportResponse resp = new MonthlyCseReportResponse(
                "TIKI_8730", "Tiki Hut", 8, 2026, "VERIFONE_CPJ", List.of(row), totals,
                Map.of("merchandise", totals));

        when(reportService.getMonthlyCseReport("TIKI_8730", "Tiki Hut", 8, 2026)).thenReturn(resp);

        mockMvc.perform(get("/api/v1/reports/departments/monthly?store=TIKI_8730&month=8&year=2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeCode").value("TIKI_8730"))
                .andExpect(jsonPath("$.departments[0].deptName").value("Beer"))
                .andExpect(jsonPath("$.departments[0].salesClass").value("merchandise"))
                .andExpect(jsonPath("$.totals.netSalesTotal").value(11140.66))
                .andExpect(jsonPath("$.classTotals.merchandise.netSalesTotal").value(11140.66));
    }

    @Test
    @DisplayName("GET /api/v1/reports/daily-register returns daily register summary")
    void dailyRegisterSummaryJson() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);

        DailyRegisterRecord record = new DailyRegisterRecord(
                LocalDate.of(2026, 9, 10), BigDecimal.valueOf(1250.50),
                BigDecimal.valueOf(3200.00), BigDecimal.valueOf(1100.00),
                BigDecimal.valueOf(150.00), 4L, 12L, BigDecimal.valueOf(25.00), BigDecimal.valueOf(10.00));
        DailyRegisterSummaryResponse resp = new DailyRegisterSummaryResponse(
                "TIKI_8730", "Tiki Hut", "VERIFONE_CPJ", List.of(record));

        when(reportService.getDailyRegisterSummary(any(), any(), any(), any())).thenReturn(resp);

        mockMvc.perform(get("/api/v1/reports/daily-register?store=TIKI_8730&date=2026-09-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeCode").value("TIKI_8730"))
                .andExpect(jsonPath("$.records[0].groceryTotal").value(1250.50))
                .andExpect(jsonPath("$.records[0].noSale").value(4));
    }

    @Test
    @DisplayName("A report database error answers 503 DATA_UNAVAILABLE, not an empty list")
    void reportDatabaseErrorIs503() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenReturn(verifoneStore);
        when(reportService.getDaySummary(any())).thenThrow(new DataAccessResourceFailureException("connection refused"));

        mockMvc.perform(get("/api/reports/day-summary?store=TIKI_8730"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATA_UNAVAILABLE"));
    }

    @Test
    @DisplayName("A store lookup (auth_db) error answers 503, not 404 Store not found")
    void storeLookupDatabaseErrorIs503() throws Exception {
        when(storeDirectoryService.resolveStore("TIKI_8730")).thenThrow(new DataAccessResourceFailureException("auth_db down"));

        mockMvc.perform(get("/api/reports/day-summary?store=TIKI_8730"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATA_UNAVAILABLE"));
    }
}