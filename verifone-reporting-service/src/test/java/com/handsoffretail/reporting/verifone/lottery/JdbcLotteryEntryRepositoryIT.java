package com.handsoffretail.reporting.verifone.lottery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.reporting.verifone.lottery.impl.JdbcLotteryEntryRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * The real SQL of {@link JdbcLotteryEntryRepository}, against a database that has the lottery_day_entry migration
 * (verifone_db V4 / gilbarco_db V7), e.g. an ingestion test database. Runs only when HOR_LOTTERY_IT_URL is set:
 * HOR_LOTTERY_IT_URL=jdbc:postgresql://localhost:5432/verifone_db_test HOR_LOTTERY_IT_USER=… HOR_LOTTERY_IT_PASSWORD=…
 * Uses business day 2000-01-01 of the first store and removes it again. Same test in both reporting services.
 */
@EnabledIfEnvironmentVariable(named = "HOR_LOTTERY_IT_URL", matches = ".+")
class JdbcLotteryEntryRepositoryIT {

    private static final LocalDate DAY = LocalDate.of(2000, 1, 1);

    private JdbcTemplate jdbc;
    private JdbcLotteryEntryRepository repository;
    private long storeId;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource ds = new DriverManagerDataSource(System.getenv("HOR_LOTTERY_IT_URL"),
                System.getenv("HOR_LOTTERY_IT_USER"), System.getenv("HOR_LOTTERY_IT_PASSWORD"));
        jdbc = new JdbcTemplate(ds);
        repository = new JdbcLotteryEntryRepository(ds);
        List<Long> stores = jdbc.queryForList("SELECT store_id FROM master.stores ORDER BY store_id LIMIT 1", Long.class);
        assumeTrue(!stores.isEmpty(), "needs at least one store in master.stores");
        storeId = stores.get(0);
        cleanUp();
    }

    @AfterEach
    void cleanUp() {
        if (jdbc != null) {
            jdbc.update("DELETE FROM report.lottery_day_entry WHERE store_id = ? AND business_date = ?", storeId, DAY);
        }
    }

    @Test
    void savesVersionsHistoryResetsAndConflicts() {
        assertThat(repository.find(storeId, DAY).version()).isZero();

        LotteryDayEntry first = repository.save(storeId, DAY, 0, Map.of(
                LotteryField.COMMISSION, new BigDecimal("45.60"),
                LotteryField.SCRATCH_TICKETS, new BigDecimal("257")), 7, "Sam Staff");
        assertThat(first.version()).isEqualTo(1);
        assertThat(first.values().get(LotteryField.COMMISSION)).isEqualByComparingTo("45.60");
        assertThat(first.values().get(LotteryField.SCRATCH_TICKETS)).isEqualByComparingTo("257");
        assertThat(first.updatedByName()).isEqualTo("Sam Staff");
        assertThat(first.updatedAt()).isNotNull();
        assertThat(history()).isEqualTo(2);

        // the same values again: nothing changes, version stays
        assertThat(repository.save(storeId, DAY, 1, Map.of(
                LotteryField.COMMISSION, new BigDecimal("45.6")), 7, "Sam Staff").version()).isEqualTo(1);
        assertThat(history()).isEqualTo(2);

        Map<LotteryField, BigDecimal> second = new HashMap<>();
        second.put(LotteryField.COMMISSION, new BigDecimal("50.00"));
        second.put(LotteryField.SETTLEMENT, null); // was not entered: no change, no history row
        LotteryDayEntry saved = repository.save(storeId, DAY, 1, second, 1, "Ann Admin");
        assertThat(saved.version()).isEqualTo(2);
        assertThat(saved.updatedByName()).isEqualTo("Ann Admin");
        assertThat(saved.values()).doesNotContainKey(LotteryField.SETTLEMENT);
        assertThat(saved.values().get(LotteryField.SCRATCH_TICKETS)).isEqualByComparingTo("257");
        assertThat(history()).isEqualTo(3);

        // someone still holding version 1
        assertThatThrownBy(() -> repository.save(storeId, DAY, 1, Map.of(
                LotteryField.COMMISSION, BigDecimal.ONE), 7, "Sam Staff"))
                .isInstanceOf(DomainException.class)
                .satisfies(e -> assertThat(((DomainException) e).properties()).containsEntry("current_version", 2));

        Map<LotteryField, BigDecimal> reset = new HashMap<>();
        reset.put(LotteryField.COMMISSION, null);
        LotteryDayEntry back = repository.save(storeId, DAY, 2, reset, 7, "Sam Staff");
        assertThat(back.version()).isEqualTo(3);
        assertThat(back.values()).doesNotContainKey(LotteryField.COMMISSION);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM report.lottery_day_entry_change WHERE store_id = ?"
                + " AND business_date = ? AND field = 'commission' AND new_value IS NULL", Integer.class, storeId, DAY))
                .isEqualTo(1);
    }

    private int history() {
        return jdbc.queryForObject("SELECT count(*) FROM report.lottery_day_entry_change WHERE store_id = ?"
                + " AND business_date = ?", Integer.class, storeId, DAY);
    }
}
