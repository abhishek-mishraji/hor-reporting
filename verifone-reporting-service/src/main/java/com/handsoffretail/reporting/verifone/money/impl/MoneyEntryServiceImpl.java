package com.handsoffretail.reporting.verifone.money.impl;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.verifone.common.config.SecurityConfig;
import com.handsoffretail.reporting.verifone.money.MoneyDayEntry;
import com.handsoffretail.reporting.verifone.money.MoneyEntryRepository;
import com.handsoffretail.reporting.verifone.money.MoneyEntryRequest;
import com.handsoffretail.reporting.verifone.money.MoneyEntryService;
import com.handsoffretail.reporting.verifone.money.MoneyField;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class MoneyEntryServiceImpl implements MoneyEntryService {

    private static final Set<String> EDIT_ROLES = Set.of(SecurityConfig.PLATFORM_ADMIN, SecurityConfig.HOR_STAFF);
    /** Largest amount numeric(12,2) holds, and a sane ceiling for a ticket count. */
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("9999999999.99");
    private static final BigDecimal MAX_COUNT = new BigDecimal("1000000");

    private final MoneyEntryRepository repository;

    public MoneyEntryServiceImpl(MoneyEntryRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean canEdit(HorPrincipal principal) {
        return principal != null && EDIT_ROLES.contains(principal.role());
    }

    @Override
    public MoneyDayEntry get(long storeId, LocalDate businessDate) {
        return repository.find(storeId, businessDate);
    }

    @Override
    public MoneyDayEntry save(HorPrincipal principal, long storeId, LocalDate businessDate,
            MoneyEntryRequest request) {
        if (!canEdit(principal)) {
            throw new DomainException(CommonErrorCode.FORBIDDEN, "Only admin and staff can edit Money Out figures.");
        }
        if (request == null || request.version() == null || request.version() < 0) {
            throw invalid("version", "Send the version you loaded (0 when nothing was entered yet).");
        }
        if (request.values() == null || request.values().isEmpty()) {
            throw invalid("values", "Send at least one Money Out figure to change.");
        }

        Map<MoneyField, BigDecimal> changes = new EnumMap<>(MoneyField.class);
        for (Map.Entry<String, BigDecimal> e : request.values().entrySet()) {
            MoneyField field = MoneyField.fromKey(e.getKey())
                    .orElseThrow(() -> invalid(e.getKey(), "Unknown Money Out figure."));
            changes.put(field, check(field, e.getValue()));
        }

        String name = principal.name() == null || principal.name().isBlank()
                ? "Account " + principal.id() : principal.name().trim();
        return repository.save(storeId, businessDate, request.version(), changes, principal.id(), name);
    }

    /** null = back to the POS figure; amounts: 2 decimals at most; counts: whole and not negative. */
    private static BigDecimal check(MoneyField field, BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (field.kind() == MoneyField.Kind.COUNT) {
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
