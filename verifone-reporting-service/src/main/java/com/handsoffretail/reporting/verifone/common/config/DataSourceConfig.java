package com.handsoffretail.reporting.verifone.common.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@Configuration
public class DataSourceConfig {

    private final ReportingProperties properties;

    public DataSourceConfig(ReportingProperties properties) {
        this.properties = properties;
    }

    private HikariDataSource createDataSource(String poolName, String dbName) {
        return createDataSource(poolName, dbName, true, 0);
    }

    private HikariDataSource createDataSource(String poolName, String dbName, boolean readOnly, int fixedPoolSize) {
        HikariConfig config = new HikariConfig();
        String host = properties.db() != null && properties.db().host() != null ? properties.db().host() : "localhost";
        int port = properties.db() != null && properties.db().port() > 0 ? properties.db().port() : 5432;
        String user = properties.db() != null && properties.db().username() != null ? properties.db().username() : "auth_svc";
        String password = properties.db() != null && properties.db().password() != null ? properties.db().password() : "";

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + dbName + "?reWriteBatchedInserts=true&logServerErrorDetail=false";
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(user);
        config.setPassword(password);
        config.setPoolName(poolName);
        config.setReadOnly(readOnly);

        int maxPool = properties.hikari() != null && properties.hikari().maximumPoolSize() > 0 ? properties.hikari().maximumPoolSize() : 10;
        int minIdle = properties.hikari() != null && properties.hikari().minimumIdle() > 0 ? properties.hikari().minimumIdle() : 2;
        long idleTimeout = properties.hikari() != null && properties.hikari().idleTimeout() > 0 ? properties.hikari().idleTimeout() : 300000;
        long connTimeout = properties.hikari() != null && properties.hikari().connectionTimeout() > 0 ? properties.hikari().connectionTimeout() : 20000;

        config.setMaximumPoolSize(fixedPoolSize > 0 ? fixedPoolSize : maxPool);
        config.setMinimumIdle(fixedPoolSize > 0 ? 0 : minIdle);
        config.setIdleTimeout(idleTimeout);
        config.setConnectionTimeout(connTimeout);
        return new HikariDataSource(config);
    }

    @Bean
    @Primary
    @Qualifier("authDataSource")
    public DataSource authDataSource() {
        String dbName = properties.authDb() != null && properties.authDb().name() != null ? properties.authDb().name() : "auth_db";
        return createDataSource("auth-db-pool", dbName);
    }

    @Bean
    @Primary
    @Qualifier("authJdbcTemplate")
    public NamedParameterJdbcTemplate authJdbcTemplate(@Qualifier("authDataSource") DataSource dataSource) {
        return new NamedParameterJdbcTemplate(dataSource);
    }

    @Bean
    @Qualifier("verifoneDataSource")
    public DataSource verifoneDataSource() {
        String dbName = properties.verifoneDb() != null && properties.verifoneDb().name() != null ? properties.verifoneDb().name() : "verifone_db";
        return createDataSource("verifone-db-pool", dbName);
    }

    /**
     * The only writable pool: used by the lottery figures admin and staff enter (report.lottery_day_entry).
     * Every report keeps reading through the read-only pool above.
     */
    @Bean
    @Qualifier("verifoneWriteDataSource")
    public DataSource verifoneWriteDataSource() {
        String dbName = properties.verifoneDb() != null && properties.verifoneDb().name() != null ? properties.verifoneDb().name() : "verifone_db";
        return createDataSource("verifone-db-write-pool", dbName, false, 2);
    }

    @Bean
    @Qualifier("verifoneJdbcTemplate")
    public NamedParameterJdbcTemplate verifoneJdbcTemplate(@Qualifier("verifoneDataSource") DataSource dataSource) {
        return new NamedParameterJdbcTemplate(dataSource);
    }

    @Bean
    @Qualifier("verifoneSimpleJdbc")
    public JdbcTemplate verifoneSimpleJdbc(@Qualifier("verifoneDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
