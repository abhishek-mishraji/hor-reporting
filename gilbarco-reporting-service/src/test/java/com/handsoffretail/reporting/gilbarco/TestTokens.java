package com.handsoffretail.reporting.gilbarco;

import com.handsoffretail.auth.client.HorJwtDecoderConfiguration;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.JwtDecoder;

public final class TestTokens {

    public static final String COOKIE = "hor_access";
    public static final String ORIGIN = "http://localhost:5173";

    private static final RSAKey KEY = generate();

    private TestTokens() {
    }

    public static JwtDecoder decoder() {
        try {
            return HorJwtDecoderConfiguration.create(KEY.toRSAPublicKey(), Clock.systemUTC());
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String platformAdmin(long adminId) {
        return sign(claims(adminId, "ADMIN", "PLATFORM_ADMIN").claim("all_stores", true).claim("stores", List.of()));
    }

    public static String horStaff(long staffId, List<Long> stores) {
        return sign(claims(staffId, "STORE_USER", "HOR_STAFF").claim("all_stores", false).claim("stores", stores));
    }

    public static String clientUser(long userId, List<Long> stores) {
        return sign(claims(userId, "STORE_USER", "CLIENT_USER").claim("all_stores", false).claim("stores", stores));
    }

    private static JWTClaimsSet.Builder claims(long subject, String type, String role) {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder().issuer("hor-auth").subject(String.valueOf(subject))
                .claim("typ", type).claim("role", role).claim("name", "Test " + role)
                .jwtID(UUID.randomUUID().toString()).issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(Duration.ofMinutes(15))));
    }

    private static String sign(JWTClaimsSet.Builder claims) {
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY.getKeyID()).build(), claims.build());
            jwt.sign(new RSASSASigner(KEY));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    private static RSAKey generate() {
        try {
            return new RSAKeyGenerator(2048).keyID("test-key").generate();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }
}
