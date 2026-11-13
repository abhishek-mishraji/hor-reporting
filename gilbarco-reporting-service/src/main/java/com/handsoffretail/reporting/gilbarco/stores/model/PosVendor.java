package com.handsoffretail.reporting.gilbarco.stores.model;

public enum PosVendor {
    GILBARCO,
    OTHER;

    public static PosVendor parse(String value) {
        if (value != null && "GILBARCO".equalsIgnoreCase(value.trim())) {
            return GILBARCO;
        }
        return OTHER;
    }
}
