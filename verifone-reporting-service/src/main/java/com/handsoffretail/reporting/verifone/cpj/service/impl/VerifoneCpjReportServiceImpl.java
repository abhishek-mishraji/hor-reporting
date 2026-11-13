package com.handsoffretail.reporting.verifone.cpj.service.impl;

import com.handsoffretail.reporting.verifone.common.dto.ReportFilterParams;
import com.handsoffretail.reporting.verifone.cpj.repository.VerifoneCpjReportRepository;
import com.handsoffretail.reporting.verifone.cpj.service.VerifoneCpjReportService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class VerifoneCpjReportServiceImpl implements VerifoneCpjReportService {

    private final VerifoneCpjReportRepository repository;

    public VerifoneCpjReportServiceImpl(VerifoneCpjReportRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<Map<String, Object>> getDaySummary(ReportFilterParams params) {
        return repository.getDaySummary(params);
    }

    @Override
    public List<Map<String, Object>> getItemsSold(ReportFilterParams params) {
        return repository.getItemsSold(params);
    }

    @Override
    public List<Map<String, Object>> getDepartments(ReportFilterParams params) {
        return repository.getDepartments(params);
    }

    @Override
    public List<Map<String, Object>> getFuel(ReportFilterParams params) {
        return repository.getFuel(params);
    }

    @Override
    public List<Map<String, Object>> getPayments(ReportFilterParams params) {
        return repository.getPayments(params);
    }

    @Override
    public List<Map<String, Object>> getCashMovements(ReportFilterParams params) {
        return repository.getCashMovements(params);
    }

    @Override
    public List<Map<String, Object>> getSuspiciousEvents(ReportFilterParams params) {
        return repository.getSuspiciousEvents(params);
    }

    @Override
    public List<Map<String, Object>> getSuspiciousDaily(ReportFilterParams params) {
        return repository.getSuspiciousDaily(params);
    }

    @Override
    public List<Map<String, Object>> getLottery(ReportFilterParams params) {
        return repository.getLottery(params);
    }

    @Override
    public List<Map<String, Object>> getLotteryPayouts(ReportFilterParams params) {
        return repository.getLotteryPayouts(params);
    }

    @Override
    public List<Map<String, Object>> getVoids(ReportFilterParams params) {
        return repository.getVoids(params);
    }

    @Override
    public com.handsoffretail.reporting.verifone.common.dto.MonthlyCseReportResponse getMonthlyCseReport(String storeCode, String storeName, int month, int year) {
        return repository.getMonthlyCseReport(storeCode, storeName, month, year);
    }

    @Override
    public com.handsoffretail.reporting.verifone.common.dto.DailyRegisterSummaryResponse getDailyRegisterSummary(String storeCode, String storeName, java.time.LocalDate from, java.time.LocalDate to) {
        return repository.getDailyRegisterSummary(storeCode, storeName, from, to);
    }

    @Override
    public List<Map<String, Object>> getDateRanges(List<String> storeCodes) {
        return repository.getDateRanges(storeCodes);
    }

    @Override
    public Optional<Map<String, Object>> getTicketDetail(long fileId, int ticketSeq) {
        return repository.getTicketDetail(fileId, ticketSeq);
    }
}
