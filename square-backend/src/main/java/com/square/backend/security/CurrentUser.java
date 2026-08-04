package com.square.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Who is making the request being handled right now.
 *
 * {@link AuthTokenFilter} resolves the bearer token to a session and stores it
 * on the request; everything downstream reads it from here rather than trusting
 * anything the client sent in the body. That distinction matters: a request may
 * claim to be for user 7, but only this tells you who is actually signed in.
 */
public final class CurrentUser {

    private CurrentUser() {}

    /** Request attribute key under which AuthTokenFilter stores the session. */
    static final String ATTRIBUTE = "square.session";

    /** The signed-in session, or null on the open endpoints (login, forgot). */
    public static TokenStore.Session session() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes sra)) return null;
        return session(sra.getRequest());
    }

    public static TokenStore.Session session(HttpServletRequest request) {
        Object s = request.getAttribute(ATTRIBUTE);
        return s instanceof TokenStore.Session session ? session : null;
    }

    public static String username() {
        var s = session();
        return s == null ? null : s.username();
    }

    public static String role() {
        var s = session();
        return s == null ? null : s.role();
    }

    public static Long id() {
        var s = session();
        return s == null ? null : s.userId();
    }

    /** True when the signed-in person is this user, or is a System admin. */
    public static boolean isSelfOrAdmin(Long userId) {
        var s = session();
        if (s == null) return false;
        return Roles.isAdmin(s.role()) || (userId != null && userId.equals(s.userId()));
    }

    public static boolean hasRole(String... roles) {
        var s = session();
        if (s == null) return false;
        if (Roles.isAdmin(s.role())) return true;
        for (String r : roles) if (r.equals(s.role())) return true;
        return false;
    }
}
