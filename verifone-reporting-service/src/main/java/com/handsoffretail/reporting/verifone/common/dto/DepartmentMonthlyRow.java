package com.handsoffretail.reporting.verifone.common.dto;

import java.math.BigDecimal;

public record DepartmentMonthlyRow(
        int deptCode,
        String deptName,
        String salesClass,
        BigDecimal gross,
        BigDecimal discount,
        BigDecimal promotion,
        BigDecimal refund,
        BigDecimal voidAmount,
        BigDecimal netSales) {}
