package com.square.backend.security;

import com.square.backend.config.CorsConfig;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gatekeeper for the whole API: every /api/** request needs a valid Bearer
 * token from login, except the auth endpoints themselves. Also stamps basic
 * security headers on every response.
 */
@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    @Autowired
    private TokenStore tokenStore;

    /** Request attribute holding the caller's origin when it is an allowed one. */
    static final String ALLOWED_ORIGIN = "square.allowedOrigin";

    @Autowired
    private CorsConfig.CorsOrigins corsOrigins;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // Hardening headers on every response
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Cache-Control", "no-store");

        String path = request.getRequestURI();
        boolean open = !path.startsWith("/api")            // non-API (nothing else served, but be explicit)
                || path.startsWith("/api/auth/")           // login + forgot-password
                || "OPTIONS".equalsIgnoreCase(request.getMethod()); // CORS preflight

        if (open) { chain.doFilter(request, response); return; }

        String header = request.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
        TokenStore.Session session = tokenStore.sessionFor(token);
        if (session == null) {
            // CORS headers here too, or the browser hides the 401 from the frontend.
            // Origins come from CorsConfig (CORS_ORIGINS env var) — not hardcoded.
            String origin = request.getHeader("Origin");
            if (corsOrigins.isAllowed(origin)) {
                response.setHeader("Access-Control-Allow-Origin", origin);
                response.setHeader("Vary", "Origin");
            }
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Sign in required.\"}");
            return;
        }

        // Who is signed in — read downstream via CurrentUser, never from the
        // request body. RoleInterceptor uses this to enforce @RequiresRole.
        request.setAttribute(CurrentUser.ATTRIBUTE, session);
        String origin = request.getHeader("Origin");
        if (corsOrigins.isAllowed(origin)) request.setAttribute(ALLOWED_ORIGIN, origin);

        chain.doFilter(request, response);
    }
}
