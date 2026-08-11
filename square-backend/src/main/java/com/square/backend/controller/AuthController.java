package com.square.backend.controller;

import com.square.backend.model.Notification;
import com.square.backend.model.User;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.security.RateLimiter;
import com.square.backend.security.TokenStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_SECONDS = 10 * 60;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private TokenStore tokenStore;

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private PasswordEncoder encoder;

    // Brute-force lockout: 5 wrong passwords locks the account for 10 minutes
    private record Attempts(int count, Instant lockedUntil) {}
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    // /login is unauthenticated, so anyone could add an entry per made-up username
    // and grow this map without limit. Sweep finished/expired entries hourly, and
    // refuse to track new ones once the map is implausibly large.
    private static final int MAX_TRACKED = 10_000;

    @Scheduled(fixedDelay = 60 * 60 * 1000L)
    void purgeStaleAttempts() {
        Instant now = Instant.now();
        attempts.entrySet().removeIf(e -> e.getValue().lockedUntil() == null
                || e.getValue().lockedUntil().isBefore(now));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials, HttpServletRequest request) {
        // Per-address cap, on top of the per-account lockout below. Stops one
        // machine spraying a single password across many usernames.
        if (!rateLimiter.allow(RateLimiter.clientKey(request))) {
            return ResponseEntity.status(429).body(Map.of("message",
                    "Too many sign-in attempts from this connection. Please wait a few minutes."));
        }
        String username = credentials.get("username") == null ? "" : credentials.get("username").trim();
        String password = credentials.get("password") == null ? "" : credentials.get("password");

        Attempts a = attempts.get(username.toLowerCase());
        if (a != null && a.lockedUntil() != null && a.lockedUntil().isAfter(Instant.now())) {
            long mins = Math.max(1, (a.lockedUntil().getEpochSecond() - Instant.now().getEpochSecond()) / 60);
            return ResponseEntity.status(423).body(Map.of("message",
                    "Too many wrong attempts — this account is locked for about " + mins + " more minute" + (mins == 1 ? "" : "s") + "."));
        }

        Optional<User> userOpt = userRepository.findByUsername(username);
        boolean ok = userOpt.isPresent() && encoder.matches(password, userOpt.get().getPassword());
        if (!ok) {
            int count = (a == null || (a.lockedUntil() != null && a.lockedUntil().isBefore(Instant.now()))) ? 1 : a.count() + 1;
            if (a != null || attempts.size() < MAX_TRACKED) {
                attempts.put(username.toLowerCase(), new Attempts(count,
                        count >= MAX_ATTEMPTS ? Instant.now().plusSeconds(LOCK_SECONDS) : null));
            }
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }

        attempts.remove(username.toLowerCase());
        User user = userOpt.get();
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "role", user.getRole(),
                "name", user.getName() == null ? user.getUsername() : user.getName(),
                "token", tokenStore.issue(user),
                "status", "SUCCESS"
        ));
    }

    // "Forgot password" — notifies the Superuser, who hands over a temporary
    // password in person. Always answers the same way, so usernames can't be probed.
    @PostMapping("/forgot")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!rateLimiter.allow(RateLimiter.clientKey(request))) {
            return ResponseEntity.status(429).body(Map.of("message",
                    "Too many requests from this connection. Please wait a few minutes."));
        }
        String username = body.get("username") == null ? "" : body.get("username").trim();
        if (!username.isEmpty()) {
            userRepository.findByUsername(username).ifPresent(user -> {
                boolean alreadyPending = !notificationRepository
                        .findByStatusAndTypeAndEmployeeUsername("PENDING", "PASSWORD_RESET", user.getUsername())
                        .isEmpty();
                if (!alreadyPending) {
                    notificationRepository.save(Notification.builder()
                            .type("PASSWORD_RESET")
                            .message((user.getName() != null ? user.getName() : user.getUsername())
                                    + " forgot their password and requested a reset.")
                            .employeeUsername(user.getUsername())
                            .dueAt(LocalDate.now())
                            .build());
                }
            });
        }
        return ResponseEntity.ok(Map.of("message",
                "If that account exists, the Superuser has been notified and will hand you a temporary password."));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String header) {
        if (header != null && header.startsWith("Bearer ")) tokenStore.revoke(header.substring(7));
        return ResponseEntity.ok(Map.of("status", "SIGNED_OUT"));
    }
}
