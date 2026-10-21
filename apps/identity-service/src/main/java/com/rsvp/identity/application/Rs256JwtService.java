package com.rsvp.identity.application;

import com.rsvp.identity.domain.AccessGrant;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Issues RS256 access tokens and publishes the matching JWKS. The {@code kid} is the RFC 7638
 * thumbprint of the public key: a restart with the same key keeps its kid, a new key gets a new one.
 */
public final class Rs256JwtService {
    public static final Duration ACCESS_LIFETIME = Duration.ofMinutes(15);
    private static final String ALGORITHM = "SHA256withRSA";
    private static final int MIN_KEY_BITS = 2048;

    private final PrivateKey privateKey;
    private final RSAPublicKey publicKey;
    private final String kid;
    private final String issuer;
    private final Clock clock;

    public Rs256JwtService(KeyPair keyPair, String issuer, Clock clock) {
        if (!(keyPair.getPublic() instanceof RSAPublicKey rsa)) throw new IllegalArgumentException("an RSA key is required");
        if (rsa.getModulus().bitLength() < MIN_KEY_BITS) throw new IllegalArgumentException("RSA keys must have at least 2048 bits");
        this.privateKey = keyPair.getPrivate();
        this.publicKey = rsa;
        this.issuer = issuer;
        this.clock = clock;
        this.kid = thumbprint(rsa);
    }

    /** A throw-away key for tests and local runs; its tokens die with the process. */
    public static KeyPair generateKeyPair() {
        try {
            var generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(MIN_KEY_BITS);
            return generator.generateKeyPair();
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    /** Reads a PKCS#8 PEM private key ("BEGIN PRIVATE KEY") and derives its public half. */
    public static KeyPair keyPairFromPkcs8Pem(String pem) {
        try {
            var body = pem.replaceAll("-----(BEGIN|END) PRIVATE KEY-----", "").replaceAll("\\s", "");
            var factory = KeyFactory.getInstance("RSA");
            var privateKey = (RSAPrivateCrtKey) factory.generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
            var publicKey = factory.generatePublic(new RSAPublicKeySpec(privateKey.getModulus(), privateKey.getPublicExponent()));
            return new KeyPair(publicKey, privateKey);
        } catch (Exception exception) { throw new IllegalArgumentException("the signing key must be an RSA PKCS#8 PEM", exception); }
    }

    public String kid() { return kid; }

    public String issue(AccessGrant grant) {
        var now = clock.instant().getEpochSecond();
        var header = b64("{\"alg\":\"RS256\",\"typ\":\"JWT\",\"kid\":" + json(kid) + "}");
        var payload = b64("{\"iss\":" + json(issuer)
            + ",\"sub\":" + json(grant.subject().toString())
            + ",\"roles\":" + jsonArray(grant.roles())
            + ",\"organizationIds\":" + jsonArray(grant.organizationIds())
            + ",\"iat\":" + now
            + ",\"exp\":" + (now + ACCESS_LIFETIME.toSeconds())
            + ",\"jti\":" + json(UUID.randomUUID().toString()) + "}");
        var signingInput = header + "." + payload;
        try {
            var signature = Signature.getInstance(ALGORITHM);
            signature.initSign(privateKey);
            signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            return signingInput + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign());
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    /** Signature check only; expiry and claims are checked by each consuming service. */
    public boolean verify(String token) {
        try {
            var parts = token.split("\\.");
            if (parts.length != 3) return false;
            var signature = Signature.getInstance(ALGORITHM);
            signature.initVerify(publicKey);
            signature.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            return signature.verify(Base64.getUrlDecoder().decode(parts[2]));
        } catch (Exception exception) { return false; }
    }

    public String jwks() {
        return "{\"keys\":[{\"kty\":\"RSA\",\"kid\":" + json(kid) + ",\"use\":\"sig\",\"alg\":\"RS256\",\"n\":\""
            + unsigned(publicKey.getModulus()) + "\",\"e\":\"" + unsigned(publicKey.getPublicExponent()) + "\"}]}";
    }

    private static String thumbprint(RSAPublicKey key) {
        var canonical = "{\"e\":\"" + unsigned(key.getPublicExponent()) + "\",\"kty\":\"RSA\",\"n\":\"" + unsigned(key.getModulus()) + "\"}";
        try { return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private static String b64(String value) { return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8)); }

    private static String unsigned(BigInteger value) {
        var bytes = value.toByteArray();
        int first = bytes.length > 1 && bytes[0] == 0 ? 1 : 0;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOfRange(bytes, first, bytes.length));
    }

    private static String jsonArray(List<String> values) { return values.stream().map(Rs256JwtService::json).collect(Collectors.joining(",", "[", "]")); }

    private static String json(String value) {
        var out = new StringBuilder("\"");
        for (char character : value.toCharArray()) {
            switch (character) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                default -> {
                    if (character < 0x20) out.append(String.format("\\u%04x", (int) character));
                    else out.append(character);
                }
            }
        }
        return out.append('"').toString();
    }
}
