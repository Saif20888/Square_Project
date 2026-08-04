package com.square.backend.security;

import com.square.backend.model.User;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory session tokens. Every /api/** call (except login/forgot) must carry
 * a valid Bearer token issued at login. Tokens expire after 12 hours of age and
 * die with a server restart — clients simply sign in again.
 */
@Component
public class TokenStore {

    private static final long TTL_SECONDS = 12 * 60 * 60;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Session> tokens = new ConcurrentHashMap<>();

    /**
     * The signed-in identity. Role and id are captured at sign-in so that
     * authorization checks on later requests cost nothing — no database lookup
     * per call. A role change therefore takes effect the next time that person
     * signs in, which is acceptable because roles change very rarely.
     */
    public record Session(String username, String role, Long userId, Instant issuedAt) {}

    public String issue(User user) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.put(token, new Session(user.getUsername(), user.getRole(), user.getId(), Instant.now()));
        return token;
    }

    /** The session behind a token, or null when it is unknown or expired. */
    public Session sessionFor(String token) {
        if (token == null) return null;
        Session s = tokens.get(token);
        if (s == null) return null;
        if (s.issuedAt().plusSeconds(TTL_SECONDS).isBefore(Instant.now())) {
            tokens.remove(token);
            return null;
        }
        return s;
    }

    public boolean isValid(String token) {
        return sessionFor(token) != null;
    }

    public void revoke(String token) {
        if (token != null) tokens.remove(token);
    }

    /** Sign out every session belonging to one account (used after a password change). */
    public void revokeAllFor(String username) {
        if (username == null) return;
        tokens.entrySet().removeIf(e -> username.equals(e.getValue().username()));
    }

    /**
     * Expired sessions are otherwise only dropped when someone happens to present
     * the same dead token again, so the map would grow for the life of the
     * process. Sweep it hourly.
     */
    @Scheduled(fixedDelay = 60 * 60 * 1000L)
    public void removeExpiredSessions() {
        Instant cutoff = Instant.now().minusSeconds(TTL_SECONDS);
        tokens.entrySet().removeIf(e -> e.getValue().issuedAt().isBefore(cutoff));
    }

    /** Number of sessions currently held — surfaced on the admin health endpoint. */
    public int activeSessionCount() {
        return tokens.size();
    }
}
