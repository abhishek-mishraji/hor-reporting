package com.handsoffretail.reporting.verifone.cpj.repository;

import com.handsoffretail.reporting.verifone.common.dto.DailyRegisterSummaryResponse;
import com.handsoffretail.reporting.verifone.common.dto.MonthlyCseReportResponse;
import com.handsoffretail.reporting.verifone.common.dto.ReportFilterParams;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface VerifoneCpjReportRepository {

    List<Map<String, Object>> getDaySummary(ReportFilterParams params);

    List<Map<String, Object>> getItemsSold(ReportFilterParams params);

    List<Map<String, Object>> getDepartments(ReportFilterParams params);

    List<Map<String, Object>> getFuel(ReportFilterParams params);

    List<Map<String, Object>> getPayments(ReportFilterParams params);

    List<Map<String, Object>> getCashMovements(ReportFilterParams params);

    List<Map<String, Object>> getSuspiciousEvents(ReportFilterParams params);

    List<Map<String, Object>> getSuspiciousDaily(ReportFilterParams params);

    List<Map<String, Object>> getLottery(ReportFilterParams params);

    List<Map<String, Object>> getLotteryPayouts(ReportFilterParams params);

    List<Map<String, Object>> getVoids(ReportFilterParams params);

    MonthlyCseReportResponse getMonthlyCseReport(String storeCode, String storeName, int month, int year);

    DailyRegisterSummaryResponse getDailyRegisterSummary(String storeCode, String storeName, java.time.LocalDate from, java.time.LocalDate to);

    List<Map<String, Object>> getDateRanges(List<String> storeCodes);

    Optional<Map<String, Object>> getTicketDetail(long fileId, int ticketSeq);
}
