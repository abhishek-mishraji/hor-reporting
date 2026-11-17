package com.handsoffretail.reporting.gilbarco.money;

import com.handsoffretail.auth.client.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

public enum MoneyErrorCode implements ErrorCode {
    /** Someone saved the same store-day after the caller loaded it; reload and try again. */
    VERSION_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatusCode status;

    MoneyErrorCode(HttpStatusCode status) {
        this.status = status;
    }

    @Override
    public String code() {
        return name();
    }

    @Override
    public HttpStatusCode status() {
        return status;
    }
}
