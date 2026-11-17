package com.handsoffretail.reporting.verifone.common.config;

import com.handsoffretail.auth.client.CsrfHeaderFilter;
import com.handsoffretail.auth.client.HorHttpSecurity;
import com.handsoffretail.auth.client.ProblemResponses;
import com.handsoffretail.auth.client.RequestLoggingFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    public static final String PLATFORM_ADMIN = "PLATFORM_ADMIN";
    public static final String HOR_STAFF = "HOR_STAFF";
    public static final String CLIENT_USER = "CLIENT_USER";

    @Bean
    SecurityFilterChain reportingFilterChain(
            HttpSecurity http,
            BearerTokenResolver tokenResolver,
            CsrfHeaderFilter csrfHeaderFilter,
            RequestLoggingFilter requestLoggingFilter) throws Exception {

        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/reporting/status", "/error").permitAll()
                        // lottery figures: everyone who sees the store reads them, only admin and staff save them
                        .requestMatchers(HttpMethod.PUT, "/api/reports/daily-lottery", "/api/reports/daily-money").hasAnyAuthority(PLATFORM_ADMIN, HOR_STAFF)
                        .requestMatchers("/api/reports/**", "/api/reporting/**", "/api/v1/**", "/api/tickets/**")
                        .hasAnyAuthority(PLATFORM_ADMIN, HOR_STAFF, CLIENT_USER)
                        .anyRequest().denyAll())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .authenticationEntryPoint(ProblemResponses.authenticationEntryPoint())
                        .bearerTokenResolver(tokenResolver)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(HorHttpSecurity.jwtAuthenticationConverter())))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(ProblemResponses.authenticationEntryPoint())
                        .accessDeniedHandler(ProblemResponses.accessDeniedHandler()))
                .addFilterAfter(requestLoggingFilter, SecurityContextHolderFilter.class)
                .addFilterBefore(csrfHeaderFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }
}
