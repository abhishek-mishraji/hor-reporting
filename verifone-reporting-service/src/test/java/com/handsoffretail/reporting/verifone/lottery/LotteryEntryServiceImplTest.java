package com.handsoffretail.reporting.verifone.lottery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.verifone.lottery.impl.LotteryEntryServiceImpl;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** Same test in both reporting services: keeps the lottery-entry rules of the two in step. */
class LotteryEntryServiceImplTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 24);
    private static final HorPrincipal ADMIN = new HorPrincipal("ADMIN", 1, "PLATFORM_ADMIN", "Ann Admin", true, Set.of());
    private static final HorPrincipal STAFF = new HorPrincipal("STORE_USER", 7, "HOR_STAFF", "Sam Staff", false, Set.of(2L));
    private static final HorPrincipal CLIENT = new HorPrincipal("STORE_USER", 9, "CLIENT_USER", "Cal Client", false, Set.of(2L));

    private LotteryEntryRepository repository;
    private LotteryEntryService service;

    @BeforeEach
    void setUp() {
        repository = mock(LotteryEntryRepository.class);
        service = new LotteryEntryServiceImpl(repository);
        when(repository.save(anyLong(), any(), anyInt(), any(), anyLong(), anyString()))
                .thenReturn(LotteryDayEntry.none(2, DAY));
    }

    @Test
    void adminAndStaffCanEditClientCannot() {
        assertThat(service.canEdit(ADMIN)).isTrue();
        assertThat(service.canEdit(STAFF)).isTrue();
        assertThat(service.canEdit(CLIENT)).isFalse();
        assertThat(service.canEdit(null)).isFalse();
    }

    @Test
    void clientUserIsForbidden() {
        assertThatThrownBy(() -> service.save(CLIENT, 2, DAY, request(0, Map.of("commission", new BigDecimal("45.60")))))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).errorCode().code()).isEqualTo("FORBIDDEN");
        verify(repository, never()).save(anyLong(), any(), anyInt(), any(), anyLong(), anyString());
    }

    @Test
    @SuppressWarnings("unchecked")
    void staffSavesAmountsCountsAndResets() {
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("commission", new BigDecimal("45.6"));
        values.put("scratch_tickets", new BigDecimal("257"));
        values.put("settlement", null); // back to the POS figure
        service.save(STAFF, 2, DAY, request(3, values));

        ArgumentCaptor<Map<LotteryField, BigDecimal>> changes = ArgumentCaptor.forClass(Map.class);
        verify(repository).save(eq(2L), eq(DAY), eq(3), changes.capture(), eq(7L), eq("Sam Staff"));
        assertThat(changes.getValue().get(LotteryField.COMMISSION)).isEqualByComparingTo("45.60");
        assertThat(changes.getValue().get(LotteryField.COMMISSION).scale()).isEqualTo(2);
        assertThat(changes.getValue().get(LotteryField.SCRATCH_TICKETS)).isEqualByComparingTo("257");
        assertThat(changes.getValue()).containsKey(LotteryField.SETTLEMENT);
        assertThat(changes.getValue().get(LotteryField.SETTLEMENT)).isNull();
    }

    @Test
    void negativeAmountsAreAllowed() {
        service.save(ADMIN, 2, DAY, request(0, Map.of("adjustment", new BigDecimal("-12.50"))));
        verify(repository).save(eq(2L), eq(DAY), eq(0), any(), eq(1L), eq("Ann Admin"));
    }

    @Test
    void rejectsBadInput() {
        assertValidation(request(0, Map.of("tip_jar", BigDecimal.ONE)), "tip_jar");
        assertValidation(request(0, Map.of("commission", new BigDecimal("1.005"))), "commission");
        assertValidation(request(0, Map.of("scratch_tickets", new BigDecimal("-1"))), "scratch_tickets");
        assertValidation(request(0, Map.of("online_tickets", new BigDecimal("2.5"))), "online_tickets");
        assertValidation(request(0, Map.of("settlement", new BigDecimal("10000000000.00"))), "settlement");
        assertValidation(request(null, Map.of("commission", BigDecimal.ONE)), "version");
        assertValidation(request(0, Map.of()), "values");
        verify(repository, never()).save(anyLong(), any(), anyInt(), any(), anyLong(), anyString());
    }

    private void assertValidation(LotteryEntryRequest request, String field) {
        assertThatThrownBy(() -> service.save(ADMIN, 2, DAY, request))
                .isInstanceOf(DomainException.class)
                .satisfies(e -> {
                    DomainException d = (DomainException) e;
                    assertThat(d.errorCode().code()).isEqualTo("VALIDATION_FAILED");
                    assertThat(d.properties().toString()).contains("field=" + field);
                });
    }

    private static LotteryEntryRequest request(Integer version, Map<String, BigDecimal> values) {
        return new LotteryEntryRequest(version, values);
    }
}
