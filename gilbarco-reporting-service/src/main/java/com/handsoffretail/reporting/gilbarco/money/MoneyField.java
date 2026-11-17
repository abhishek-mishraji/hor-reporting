package com.handsoffretail.reporting.gilbarco.money;

import java.util.Arrays;
import java.util.Optional;

/**
 * The Money Out figures admin and staff may enter for one store-day (Daily report "Money Out" section: Safe
 * Deposits, Credit Card 2, Bank Deposits, Cash Purchases, Other Money Received, ATM Reading).
 * Total deposits = cash deposit + check deposit. The JSON key, the column of report.money_day_entry and the
 * history field name are all {@link #key()}. Same enum in both reporting services.
 */
public enum MoneyField {
    CASH_DEPOSIT("cash_deposit", Kind.AMOUNT),   // POS: safe drops
    CHECK_DEPOSIT("check_deposit", Kind.AMOUNT), // not in the POS: 0 until entered
    CARD_BATCH("card_batch", Kind.AMOUNT),       // POS: credit, debit, pump and mobile card payments
    GENERIC_CARD_1("generic_card_1", Kind.AMOUNT),
    GENERIC_CARD_2("generic_card_2", Kind.AMOUNT),
    EBT("ebt", Kind.AMOUNT),                     // POS: EBT payments
    CASH_PURCHASES("cash_purchases", Kind.AMOUNT), // POS: store paid-outs
    CASH_EXPENSES("cash_expenses", Kind.AMOUNT),
    GENERAL_ACCOUNT_PAID("general_account_paid", Kind.AMOUNT),
    OTHER_INCOME("other_income", Kind.AMOUNT),   // POS: pay-ins
    CUST_ACCOUNT_SALES("cust_account_sales", Kind.AMOUNT), // POS: house charges
    CUST_ACCOUNT_PAYMENTS("cust_account_payments", Kind.AMOUNT),
    GENERAL_ACCOUNT_RECEIVED("general_account_received", Kind.AMOUNT),
    ATM_TRANS("atm_trans", Kind.COUNT),          // number of ATM transactions
    ATM_DISPENSED("atm_dispensed", Kind.AMOUNT),
    ATM_FEE("atm_fee", Kind.AMOUNT);

    public enum Kind { AMOUNT, COUNT }

    private final String key;
    private final Kind kind;

    MoneyField(String key, Kind kind) {
        this.key = key;
        this.kind = kind;
    }

    /** JSON key, table column and history field name (a fixed identifier, safe to put in SQL). */
    public String key() {
        return key;
    }

    public Kind kind() {
        return kind;
    }

    public static Optional<MoneyField> fromKey(String key) {
        return Arrays.stream(values()).filter(f -> f.key.equals(key)).findFirst();
    }
}
