package com.square.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequiresRole} before a controller method runs.
 *
 * Authentication (is this a real session?) happens in {@link AuthTokenFilter}.
 * Authorization (is this session allowed to do THIS?) happens here. Both are
 * needed: before this existed, any signed-in employee could call the Superuser
 * and admin endpoints directly, because the role check lived only in the React
 * UI and a UI check is trivially bypassed.
 */
@Component
public class RoleInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RoleInterceptor.class);

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod method)) return true;

        RequiresRole required = method.getMethodAnnotation(RequiresRole.class);
        if (required == null) required = method.getBeanType().getAnnotation(RequiresRole.class);
        if (required == null) return true;   // no restriction declared

        TokenStore.Session session = CurrentUser.session(request);
        if (session == null) return deny(request, response, 401, "Sign in required.");

        if (Roles.isAdmin(session.role())) return true;
        for (String allowed : required.value()) {
            if (allowed.equals(session.role())) return true;
        }

        log.warn("Blocked {} {} for user '{}' with role {}",
                request.getMethod(), request.getRequestURI(), session.username(), session.role());
        return deny(request, response, 403, "You do not have permission to do that.");
    }

    private boolean deny(HttpServletRequest request, HttpServletResponse response, int status, String message)
            throws java.io.IOException {
        // Mirror the CORS header so the browser lets the frontend read the error
        String origin = request.getHeader("Origin");
        if (origin != null && response.getHeader("Access-Control-Allow-Origin") == null) {
            Object allowed = request.getAttribute(AuthTokenFilter.ALLOWED_ORIGIN);
            if (origin.equals(allowed)) {
                response.setHeader("Access-Control-Allow-Origin", origin);
                response.setHeader("Vary", "Origin");
            }
        }
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
        return false;
    }
}
