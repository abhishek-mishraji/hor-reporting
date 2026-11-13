package com.handsoffretail.reporting.gilbarco.common.dto;

import java.util.List;
import java.util.Map;

public record MonthlyCseReportResponse(
        String storeCode,
        String storeName,
        int reportMonth,
        int reportYear,
        String posType,
        List<DepartmentMonthlyRow> departments,
        // merchandise only: lottery and fuel are never part of merchandise sales
        CseReportTotals totals,
        // one entry per sales class present: merchandise, lottery_sale, lottery_payout, fuel
        Map<String, CseReportTotals> classTotals) {}
