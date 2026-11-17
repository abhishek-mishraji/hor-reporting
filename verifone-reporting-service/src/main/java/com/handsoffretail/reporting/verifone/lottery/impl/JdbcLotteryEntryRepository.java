package com.handsoffretail.reporting.verifone.lottery.impl;

import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.reporting.verifone.lottery.LotteryDayEntry;
import com.handsoffretail.reporting.verifone.lottery.LotteryEntryRepository;
import com.handsoffretail.reporting.verifone.lottery.LotteryErrorCode;
import com.handsoffretail.reporting.verifone.lottery.LotteryField;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * report.lottery_day_entry / report.lottery_day_entry_change (migration V4 in verifone_db, V7 in gilbarco_db).
 * Uses the only writable connection pool of the service; every other report reads through the read-only pool.
 */
@Repository
public class JdbcLotteryEntryRepository implements LotteryEntryRepository {

    private static final String COLUMNS = Arrays.stream(LotteryField.values())
            .map(LotteryField::key).collect(Collectors.joining(", "));

    private final NamedParameterJdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public JdbcLotteryEntryRepository(@Qualifier("verifoneWriteDataSource") DataSource dataSource) {
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
        this.tx = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    }

    @Override
    public LotteryDayEntry find(long storeId, LocalDate businessDate) {
        return select(storeId, businessDate, false);
    }

    @Override
    public LotteryDayEntry save(long storeId, LocalDate businessDate, int expectedVersion,
            Map<LotteryField, BigDecimal> changes, long actorId, String actorName) {
        return tx.execute(status -> {
            LotteryDayEntry current = select(storeId, businessDate, true);
            if (current.version() != expectedVersion) {
                throw conflict(current.version());
            }

            List<LotteryField> changed = changes.entrySet().stream()
                    .filter(e -> !sameValue(current.values().get(e.getKey()), e.getValue()))
                    .map(Map.Entry::getKey)
                    .toList();
            if (changed.isEmpty()) {
                return current;
            }

            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("store_id", storeId)
                    .addValue("business_date", businessDate)
                    .addValue("actor_id", actorId)
                    .addValue("actor_name", actorName);
            for (LotteryField field : LotteryField.values()) {
                BigDecimal value = changes.containsKey(field) ? changes.get(field) : current.values().get(field);
                params.addValue(field.key(), value);
            }

            if (current.version() == 0) {
                int inserted = jdbc.update("INSERT INTO report.lottery_day_entry (store_id, business_date, " + COLUMNS
                        + ", version, updated_by, updated_by_name) VALUES (:store_id, :business_date, "
                        + Arrays.stream(LotteryField.values()).map(f -> ":" + f.key()).collect(Collectors.joining(", "))
                        + ", 1, :actor_id, :actor_name) ON CONFLICT (store_id, business_date) DO NOTHING", params);
                if (inserted == 0) {
                    // another first save of the same day won the race
                    throw conflict(select(storeId, businessDate, false).version());
                }
            } else {
                jdbc.update("UPDATE report.lottery_day_entry SET "
                        + Arrays.stream(LotteryField.values()).map(f -> f.key() + " = :" + f.key())
                                .collect(Collectors.joining(", "))
                        + ", version = version + 1, updated_by = :actor_id, updated_by_name = :actor_name,"
                        + " updated_at = now() WHERE store_id = :store_id AND business_date = :business_date", params);
            }

            List<MapSqlParameterSource> history = new ArrayList<>();
            for (LotteryField field : changed) {
                history.add(new MapSqlParameterSource()
                        .addValue("store_id", storeId)
                        .addValue("business_date", businessDate)
                        .addValue("field", field.key())
                        .addValue("old_value", current.values().get(field))
                        .addValue("new_value", changes.get(field))
                        .addValue("actor_id", actorId)
                        .addValue("actor_name", actorName));
            }
            jdbc.batchUpdate("INSERT INTO report.lottery_day_entry_change (store_id, business_date, field, old_value,"
                    + " new_value, changed_by, changed_by_name) VALUES (:store_id, :business_date, :field, :old_value,"
                    + " :new_value, :actor_id, :actor_name)", history.toArray(MapSqlParameterSource[]::new));

            return select(storeId, businessDate, false);
        });
    }

    private LotteryDayEntry select(long storeId, LocalDate businessDate, boolean forUpdate) {
        List<LotteryDayEntry> rows = jdbc.query("SELECT store_id, business_date, " + COLUMNS
                + ", version, updated_by, updated_by_name, updated_at FROM report.lottery_day_entry"
                + " WHERE store_id = :store_id AND business_date = :business_date" + (forUpdate ? " FOR UPDATE" : ""),
                new MapSqlParameterSource().addValue("store_id", storeId).addValue("business_date", businessDate),
                (rs, i) -> map(rs));
        return rows.isEmpty() ? LotteryDayEntry.none(storeId, businessDate) : rows.get(0);
    }

    private static LotteryDayEntry map(ResultSet rs) throws SQLException {
        Map<LotteryField, BigDecimal> values = new EnumMap<>(LotteryField.class);
        for (LotteryField field : LotteryField.values()) {
            BigDecimal v = rs.getBigDecimal(field.key());
            if (v != null) {
                values.put(field, v);
            }
        }
        return new LotteryDayEntry(
                rs.getLong("store_id"),
                rs.getObject("business_date", LocalDate.class),
                values,
                rs.getInt("version"),
                rs.getLong("updated_by"),
                rs.getString("updated_by_name"),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

    private static boolean sameValue(BigDecimal a, BigDecimal b) {
        return Objects.equals(a, b) || (a != null && b != null && a.compareTo(b) == 0);
    }

    private static DomainException conflict(int currentVersion) {
        return new DomainException(LotteryErrorCode.VERSION_CONFLICT,
                "Someone else saved the lottery figures of this day. Reload to see them, then try again.",
                Map.of("current_version", currentVersion));
    }
}
