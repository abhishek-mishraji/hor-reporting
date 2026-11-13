package com.handsoffretail.reporting.verifone.stores.model;

public enum PosVendor {
    VERIFONE,
    OTHER;

    public static PosVendor parse(String value) {
        if (value != null && "VERIFONE".equalsIgnoreCase(value.trim())) {
            return VERIFONE;
        }
        return OTHER;
    }
}
