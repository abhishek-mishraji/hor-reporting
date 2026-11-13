package com.handsoffretail.reporting.verifone.common.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;

public record StoreDateRangeDto(
        @JsonProperty("store_id") long storeId,
        @JsonProperty("store_code") String storeCode,
        @JsonProperty("store_name") String storeName,
        @JsonProperty("pos_vendor") String posVendor,
        @JsonProperty("first_day") LocalDate firstDay,
        @JsonProperty("last_day") LocalDate lastDay,
        @JsonProperty("files") long files) {
}
