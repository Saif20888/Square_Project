package com.square.backend.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window rate limiting per client address.
 *
 * The account lockout in AuthController stops repeated guesses at ONE username.
 * It does nothing about a single machine trying one password against hundreds
 * of usernames, which never trips any individual account's counter. This caps
 * how often one address may call the sign-in endpoints at all.
 *
 * A last line of defence, not the only one: run rate limiting at the reverse
 * proxy too, so abusive traffic is dropped before it reaches the application.
 */
@Component
public class RateLimiter {

    /** Sign-in attempts allowed from one address per window. */
    private static final int MAX_PER_WINDOW = 20;
    private static final long WINDOW_SECONDS = 5 * 60;
    /** Stop tracking new addresses beyond this, so the map cannot grow without limit. */
    private static final int MAX_TRACKED = 50_000;

    private record Window(int count, Instant startedAt) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /**
     * Records one attempt from this address and reports whether it is allowed.
     * Returns false once the address has exceeded its allowance for the window.
     */
    public boolean allow(String clientKey) {
        if (clientKey == null || clientKey.isBlank()) return true;
        Instant now = Instant.now();

        Window existing = windows.get(clientKey);
        if (existing == null) {
            if (windows.size() >= MAX_TRACKED) return true;   // stop tracking, don't start denying
            windows.put(clientKey, new Window(1, now));
            return true;
        }
        if (existing.startedAt().plusSeconds(WINDOW_SECONDS).isBefore(now)) {
            windows.put(clientKey, new Window(1, now));       // window elapsed, start again
            return true;
        }
        int next = existing.count() + 1;
        windows.put(clientKey, new Window(next, existing.startedAt()));
        return next <= MAX_PER_WINDOW;
    }

    /**
     * The caller's address. X-Forwarded-For is only meaningful when a trusted
     * proxy sets it; if this ever runs without one in front, a client could
     * forge the header, which is why the direct socket address is the fallback.
     */
    public static String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    void purgeElapsedWindows() {
        Instant cutoff = Instant.now().minusSeconds(WINDOW_SECONDS);
        windows.entrySet().removeIf(e -> e.getValue().startedAt().isBefore(cutoff));
    }

    int trackedCount() {
        return windows.size();
    }
}
