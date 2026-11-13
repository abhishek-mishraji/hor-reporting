package com.handsoffretail.reporting.verifone.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hor.reporting")
public record ReportingProperties(
        DatabaseConfig db,
        DatabaseNames authDb,
        DatabaseNames verifoneDb,
        HikariConfig hikari) {

    public record DatabaseConfig(
            String host,
            int port,
            String username,
            String password) {
    }

    public record DatabaseNames(
            String name) {
    }

    public record HikariConfig(
            int maximumPoolSize,
            int minimumIdle,
            long idleTimeout,
            long connectionTimeout) {
    }
}
