package com.handsoffretail.reporting.gilbarco.stores.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record StoreRecord(
        @JsonProperty("store_id") long storeId,
        @JsonProperty("store_code") String storeCode,
        @JsonProperty("store_name") String storeName,
        @JsonProperty("pos_vendor") PosVendor posVendor,
        @JsonProperty("timezone") String timezone,
        @JsonProperty("status") String status) {

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status);
    }
}
