package com.handsoffretail.reporting.gilbarco.money;

import com.handsoffretail.auth.client.HorPrincipal;
import java.time.LocalDate;

public interface MoneyEntryService {

    /** True for platform admins and HOR staff: the roles that may enter Money Out figures. */
    boolean canEdit(HorPrincipal principal);

    MoneyDayEntry get(long storeId, LocalDate businessDate);

    /**
     * Validates and saves the entered figures of one store-day.
     *
     * @throws com.handsoffretail.auth.client.DomainException FORBIDDEN (client user), VALIDATION_FAILED (bad
     *         body), VERSION_CONFLICT (someone saved the day after the caller loaded it)
     */
    MoneyDayEntry save(HorPrincipal principal, long storeId, LocalDate businessDate, MoneyEntryRequest request);
}
