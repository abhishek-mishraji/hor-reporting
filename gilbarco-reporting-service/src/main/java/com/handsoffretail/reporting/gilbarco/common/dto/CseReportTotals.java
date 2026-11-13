package com.handsoffretail.reporting.gilbarco.common.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public record CseReportTotals(
        BigDecimal grossTotal,
        BigDecimal discountTotal,
        BigDecimal promotionTotal,
        BigDecimal refundTotal,
        BigDecimal voidTotal,
        BigDecimal netSalesTotal) {

    public static CseReportTotals sum(List<DepartmentMonthlyRow> rows) {
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal promotion = BigDecimal.ZERO;
        BigDecimal refund = BigDecimal.ZERO;
        BigDecimal voidAmount = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        for (DepartmentMonthlyRow r : rows) {
            gross = gross.add(r.gross());
            discount = discount.add(r.discount());
            promotion = promotion.add(r.promotion());
            refund = refund.add(r.refund());
            voidAmount = voidAmount.add(r.voidAmount());
            net = net.add(r.netSales());
        }
        return new CseReportTotals(
                gross.setScale(2, RoundingMode.HALF_UP),
                discount.setScale(2, RoundingMode.HALF_UP),
                promotion.setScale(2, RoundingMode.HALF_UP),
                refund.setScale(2, RoundingMode.HALF_UP),
                voidAmount.setScale(2, RoundingMode.HALF_UP),
                net.setScale(2, RoundingMode.HALF_UP));
    }
}
