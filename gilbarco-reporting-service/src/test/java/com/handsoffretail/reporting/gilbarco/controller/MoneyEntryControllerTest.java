package com.handsoffretail.reporting.gilbarco.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.ProblemDetailsAdvice;
import com.handsoffretail.reporting.gilbarco.common.web.DataAccessAdvice;
import com.handsoffretail.reporting.gilbarco.money.MoneyDayEntry;
import com.handsoffretail.reporting.gilbarco.money.MoneyEntryRepository;
import com.handsoffretail.reporting.gilbarco.money.MoneyErrorCode;
import com.handsoffretail.reporting.gilbarco.money.MoneyField;
import com.handsoffretail.reporting.gilbarco.money.impl.MoneyEntryServiceImpl;
import com.handsoffretail.reporting.gilbarco.security.StoreSecurityService;
import com.handsoffretail.reporting.gilbarco.stores.model.PosVendor;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import com.handsoffretail.reporting.gilbarco.stores.service.StoreDirectoryService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Contract of /api/reports/daily-money. Same test in both reporting services (only the vendor differs), so
 * the JSON of the two services cannot drift apart.
 */
class MoneyEntryControllerTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 24);
    private static final PosVendor VENDOR = PosVendor.GILBARCO;
    private final StoreRecord store = new StoreRecord(2L, "STORE_2", "Store 2", VENDOR, "America/New_York", "ACTIVE");

    private final StoreDirectoryService directory = mock(StoreDirectoryService.class);
    private final StoreSecurityService security = mock(StoreSecurityService.class);
    private final MoneyEntryRepository repository = mock(MoneyEntryRepository.class);

    private MockMvc mvc(String role) {
        when(directory.resolveStore("STORE_2")).thenReturn(store);
        MoneyEntryController controller = new MoneyEntryController(
                directory, security, new MoneyEntryServiceImpl(repository));
        HandlerMethodArgumentResolver jwt = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                        && parameter.getParameterType().equals(Jwt.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav,
                    NativeWebRequest request, WebDataBinderFactory binder) {
                return Jwt.withTokenValue("t").header("alg", "RS256").subject("7")
                        .claim("typ", "STORE_USER").claim("role", role).claim("name", "Sam Staff")
                        .claim("all_stores", false).claim("stores", List.of(2L)).build();
            }
        };
        return MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(jwt)
                .setControllerAdvice(new DataAccessAdvice(), new ProblemDetailsAdvice())
                .build();
    }

    private static MoneyDayEntry saved() {
        return new MoneyDayEntry(2L, DAY,
                Map.of(MoneyField.CHECK_DEPOSIT, new BigDecimal("45.60"), MoneyField.CARD_BATCH, new BigDecimal("257")),
                3, 7L, "Sam Staff", OffsetDateTime.of(2026, 11, 17, 9, 30, 0, 0, ZoneOffset.UTC));
    }

    @Test
    void getReturnsEnteredValuesVersionAndEditRight() throws Exception {
        when(repository.find(2L, DAY)).thenReturn(saved());
        mvc("HOR_STAFF").perform(get("/api/reports/daily-money?store=STORE_2&date=2026-10-24"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.store_code").value("STORE_2"))
                .andExpect(jsonPath("$.business_date").value("2026-10-24"))
                .andExpect(jsonPath("$.can_edit").value(true))
                .andExpect(jsonPath("$.version").value(3))
                .andExpect(jsonPath("$.values.check_deposit").value(45.60))
                .andExpect(jsonPath("$.values.card_batch").value(257.00))
                .andExpect(jsonPath("$.values.cash_deposit").doesNotExist())
                .andExpect(jsonPath("$.updated_by_name").value("Sam Staff"));
    }

    @Test
    void getWithNothingEnteredIsVersionZero() throws Exception {
        when(repository.find(2L, DAY)).thenReturn(MoneyDayEntry.none(2L, DAY));
        mvc("CLIENT_USER").perform(get("/api/reports/daily-money?store=STORE_2&date=2026-10-24"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.can_edit").value(false))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.values").isEmpty());
    }

    @Test
    void putSavesForStaff() throws Exception {
        when(repository.save(eq(2L), eq(DAY), eq(2), any(), eq(7L), eq("Sam Staff"))).thenReturn(saved());
        mvc("HOR_STAFF").perform(put("/api/reports/daily-money?store=STORE_2&date=2026-10-24")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"values\":{\"check_deposit\":45.60,\"cash_deposit\":null}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3))
                .andExpect(jsonPath("$.values.check_deposit").value(45.60));
    }

    @Test
    void putIsForbiddenForClientUser() throws Exception {
        mvc("CLIENT_USER").perform(put("/api/reports/daily-money?store=STORE_2&date=2026-10-24")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"values\":{\"check_deposit\":1}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void putAnswers409WhenSomeoneSavedFirst() throws Exception {
        when(repository.save(anyLong(), any(), anyInt(), any(), anyLong(), anyString()))
                .thenThrow(new DomainException(MoneyErrorCode.VERSION_CONFLICT, "Someone else saved.",
                        Map.of("current_version", 4)));
        mvc("PLATFORM_ADMIN").perform(put("/api/reports/daily-money?store=STORE_2&date=2026-10-24")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"values\":{\"check_deposit\":1}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
                .andExpect(jsonPath("$.current_version").value(4));
    }

    @Test
    void putRejectsUnknownField() throws Exception {
        mvc("PLATFORM_ADMIN").perform(put("/api/reports/daily-money?store=STORE_2&date=2026-10-24")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"values\":{\"tip_jar\":1}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("tip_jar"));
    }

    @Test
    void storeOfTheOtherVendorIsNotFound() throws Exception {
        when(directory.resolveStore("OTHER")).thenReturn(
                new StoreRecord(5L, "OTHER", "Other", PosVendor.OTHER, "America/Chicago", "ACTIVE"));
        mvc("PLATFORM_ADMIN").perform(get("/api/reports/daily-money?store=OTHER&date=2026-10-24"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(CommonErrorCode.NOT_FOUND.code()));
    }
}
