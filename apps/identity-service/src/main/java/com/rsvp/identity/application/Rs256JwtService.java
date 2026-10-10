package com.rsvp.identity.application;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public final class Rs256JwtService {
    private final KeyPair keyPair;
    public Rs256JwtService() {
        try { var generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048); keyPair = generator.generateKeyPair(); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }
    public String issue(UUID subject) {
        var header = b64("{\"alg\":\"RS256\",\"typ\":\"JWT\",\"kid\":\"local-v1\"}");
        var payload = b64("{\"sub\":\"" + subject + "\",\"iat\":" + Instant.now().getEpochSecond() + ",\"exp\":" + Instant.now().plusSeconds(900).getEpochSecond() + "}");
        var signingInput = header + "." + payload;
        try { var signature = Signature.getInstance("SHA256withRSA"); signature.initSign(keyPair.getPrivate()); signature.update(signingInput.getBytes(StandardCharsets.US_ASCII)); return signingInput + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign()); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }
    public boolean verify(String token) {
        try {
            var parts = token.split("\\."); if (parts.length != 3) return false;
            var signature = Signature.getInstance("SHA256withRSA"); signature.initVerify(keyPair.getPublic()); signature.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            return signature.verify(Base64.getUrlDecoder().decode(parts[2]));
        } catch (Exception exception) { return false; }
    }
    public String jwks() {
        var key = (RSAPublicKey) keyPair.getPublic();
        return "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"local-v1\",\"use\":\"sig\",\"alg\":\"RS256\",\"n\":\"" + b64Unsigned(key.getModulus().toByteArray()) + "\",\"e\":\"" + b64Unsigned(key.getPublicExponent().toByteArray()) + "\"}]}";
    }
    private static String b64(String value) { return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8)); }
    private static String b64Unsigned(byte[] bytes) { int first = bytes.length > 1 && bytes[0] == 0 ? 1 : 0; return Base64.getUrlEncoder().withoutPadding().encodeToString(java.util.Arrays.copyOfRange(bytes, first, bytes.length)); }
}

