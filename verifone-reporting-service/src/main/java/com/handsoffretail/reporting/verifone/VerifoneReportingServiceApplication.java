package com.handsoffretail.reporting.verifone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class VerifoneReportingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(VerifoneReportingServiceApplication.class, args);
    }
}
