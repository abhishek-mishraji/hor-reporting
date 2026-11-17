package com.handsoffretail.reporting.gilbarco.money;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public interface MoneyEntryRepository {

    /** The entered figures of the store-day; {@link MoneyDayEntry#none} when nothing was entered. */
    MoneyDayEntry find(long storeId, LocalDate businessDate);

    /**
     * Applies {@code changes} (null value = back to the POS figure) if the store-day is still at
     * {@code expectedVersion}, records one history row per field whose value really changes and raises the
     * version. Nothing changes (and the version stays) when every value is already as requested.
     *
     * @throws com.handsoffretail.auth.client.DomainException VERSION_CONFLICT when someone saved in between
     */
    MoneyDayEntry save(long storeId, LocalDate businessDate, int expectedVersion,
            Map<MoneyField, BigDecimal> changes, long actorId, String actorName);
}
