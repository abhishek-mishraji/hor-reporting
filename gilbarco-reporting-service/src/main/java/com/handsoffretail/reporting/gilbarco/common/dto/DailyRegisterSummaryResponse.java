package com.handsoffretail.reporting.gilbarco.common.dto;

import java.util.List;

public record DailyRegisterSummaryResponse(
        String storeCode,
        String storeName,
        String posType,
        List<DailyRegisterRecord> records) {}
