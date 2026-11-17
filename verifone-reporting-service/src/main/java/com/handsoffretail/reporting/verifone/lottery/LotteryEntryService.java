package com.handsoffretail.reporting.verifone.lottery;

import com.handsoffretail.auth.client.HorPrincipal;
import java.time.LocalDate;

public interface LotteryEntryService {

    /** True for platform admins and HOR staff: the roles that may enter lottery figures. */
    boolean canEdit(HorPrincipal principal);

    LotteryDayEntry get(long storeId, LocalDate businessDate);

    /**
     * Validates and saves the entered figures of one store-day.
     *
     * @throws com.handsoffretail.auth.client.DomainException FORBIDDEN (client user), VALIDATION_FAILED (bad
     *         body), VERSION_CONFLICT (someone saved the day after the caller loaded it)
     */
    LotteryDayEntry save(HorPrincipal principal, long storeId, LocalDate businessDate, LotteryEntryRequest request);
}
