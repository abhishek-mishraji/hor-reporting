package com.handsoffretail.reporting.verifone.lottery;

import com.handsoffretail.auth.client.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

public enum LotteryErrorCode implements ErrorCode {
    /** Someone saved the same store-day after the caller loaded it; reload and try again. */
    VERSION_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatusCode status;

    LotteryErrorCode(HttpStatusCode status) {
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
