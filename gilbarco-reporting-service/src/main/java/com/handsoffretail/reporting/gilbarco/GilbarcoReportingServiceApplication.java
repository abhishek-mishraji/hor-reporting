package com.handsoffretail.reporting.gilbarco;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class GilbarcoReportingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(GilbarcoReportingServiceApplication.class, args);
    }
}
