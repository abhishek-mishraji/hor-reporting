package com.handsoffretail.reporting.gilbarco.lottery.impl;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.gilbarco.common.config.SecurityConfig;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryDayEntry;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryEntryRepository;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryEntryRequest;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryEntryService;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryField;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class LotteryEntryServiceImpl implements LotteryEntryService {

    private static final Set<String> EDIT_ROLES = Set.of(SecurityConfig.PLATFORM_ADMIN, SecurityConfig.HOR_STAFF);
    /** Largest amount numeric(12,2) holds, and a sane ceiling for a ticket count. */
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("9999999999.99");
    private static final BigDecimal MAX_COUNT = new BigDecimal("1000000");

    private final LotteryEntryRepository repository;

    public LotteryEntryServiceImpl(LotteryEntryRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean canEdit(HorPrincipal principal) {
        return principal != null && EDIT_ROLES.contains(principal.role());
    }

    @Override
    public LotteryDayEntry get(long storeId, LocalDate businessDate) {
        return repository.find(storeId, businessDate);
    }

    @Override
    public LotteryDayEntry save(HorPrincipal principal, long storeId, LocalDate businessDate,
            LotteryEntryRequest request) {
        if (!canEdit(principal)) {
            throw new DomainException(CommonErrorCode.FORBIDDEN, "Only admin and staff can edit lottery figures.");
        }
        if (request == null || request.version() == null || request.version() < 0) {
            throw invalid("version", "Send the version you loaded (0 when nothing was entered yet).");
        }
        if (request.values() == null || request.values().isEmpty()) {
            throw invalid("values", "Send at least one lottery figure to change.");
        }

        Map<LotteryField, BigDecimal> changes = new EnumMap<>(LotteryField.class);
        for (Map.Entry<String, BigDecimal> e : request.values().entrySet()) {
            LotteryField field = LotteryField.fromKey(e.getKey())
                    .orElseThrow(() -> invalid(e.getKey(), "Unknown lottery figure."));
            changes.put(field, check(field, e.getValue()));
        }

        String name = principal.name() == null || principal.name().isBlank()
                ? "Account " + principal.id() : principal.name().trim();
        return repository.save(storeId, businessDate, request.version(), changes, principal.id(), name);
    }

    /** null = back to the POS figure; amounts: 2 decimals at most; counts: whole and not negative. */
    private static BigDecimal check(LotteryField field, BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (field.kind() == LotteryField.Kind.COUNT) {
            if (value.signum() < 0 || value.stripTrailingZeros().scale() > 0 || value.compareTo(MAX_COUNT) > 0) {
                throw invalid(field.key(), "Enter a whole number of tickets, 0 or more.");
            }
            return value.setScale(0);
        }
        if (value.stripTrailingZeros().scale() > 2 || value.abs().compareTo(MAX_AMOUNT) > 0) {
            throw invalid(field.key(), "Enter a dollar amount with at most 2 decimals.");
        }
        return value.setScale(2);
    }

    private static DomainException invalid(String field, String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("field", field);
        error.put("message", message);
        return new DomainException(CommonErrorCode.VALIDATION_FAILED, message, Map.of("errors", java.util.List.of(error)));
    }
}
