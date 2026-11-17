package com.handsoffretail.reporting.gilbarco.controller;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryDayEntry;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryEntryRequest;
import com.handsoffretail.reporting.gilbarco.lottery.LotteryEntryService;
import com.handsoffretail.reporting.gilbarco.security.StoreSecurityService;
import com.handsoffretail.reporting.gilbarco.stores.model.PosVendor;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import com.handsoffretail.reporting.gilbarco.stores.service.StoreDirectoryService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lottery figures entered by admin and staff for the Daily report (same contract in both reporting services):
 * GET  /api/reports/daily-lottery?store&date  everyone who may see the store
 * PUT  /api/reports/daily-lottery?store&date  platform admin and HOR staff only
 */
@RestController
public class LotteryEntryController {

    private static final PosVendor VENDOR = PosVendor.GILBARCO;

    private final StoreDirectoryService storeDirectoryService;
    private final StoreSecurityService storeSecurityService;
    private final LotteryEntryService lotteryEntryService;

    public LotteryEntryController(
            StoreDirectoryService storeDirectoryService,
            StoreSecurityService storeSecurityService,
            LotteryEntryService lotteryEntryService) {
        this.storeDirectoryService = storeDirectoryService;
        this.storeSecurityService = storeSecurityService;
        this.lotteryEntryService = lotteryEntryService;
    }

    @GetMapping("/api/reports/daily-lottery")
    public ResponseEntity<Map<String, Object>> get(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String store,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        StoreRecord record = resolve(principal, store);
        LotteryDayEntry entry = lotteryEntryService.get(record.storeId(), date);
        return ResponseEntity.ok(entry.toJson(record.storeCode(), lotteryEntryService.canEdit(principal)));
    }

    @PutMapping("/api/reports/daily-lottery")
    public ResponseEntity<Map<String, Object>> save(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String store,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody LotteryEntryRequest request) {
        HorPrincipal principal = HorPrincipal.from(jwt);
        StoreRecord record = resolve(principal, store);
        LotteryDayEntry entry = lotteryEntryService.save(principal, record.storeId(), date, request);
        return ResponseEntity.ok(entry.toJson(record.storeCode(), true));
    }

    private StoreRecord resolve(HorPrincipal principal, String storeCodeOrId) {
        StoreRecord store = storeDirectoryService.resolveStore(storeCodeOrId);
        storeSecurityService.validateAccess(principal, store.storeId());
        if (store.posVendor() != VENDOR) {
            throw new DomainException(CommonErrorCode.NOT_FOUND, "Store not found.");
        }
        return store;
    }
}
