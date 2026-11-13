package com.handsoffretail.reporting.gilbarco.common.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * A database that cannot be read is an error, never an empty report: answers 503 DATA_UNAVAILABLE and logs the
 * cause. Ordered before auth-client's ProblemDetailsAdvice, whose catch-all would answer an unlogged 500.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DataAccessAdvice {

    private static final Logger log = LoggerFactory.getLogger(DataAccessAdvice.class);

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ProblemDetail> handleDataAccess(DataAccessException exception) {
        log.error("Database query failed", exception);
        ProblemDetail body = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE, "Report data could not be read. Try again later.");
        body.setTitle(HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase());
        body.setProperty("code", "DATA_UNAVAILABLE");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(body);
    }
}
