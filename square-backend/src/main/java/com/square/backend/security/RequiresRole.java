package com.square.backend.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Restricts an endpoint to the listed roles. Enforced by {@link RoleInterceptor}
 * on the server, so it holds even when the caller bypasses the UI entirely.
 *
 * <pre>
 *   &#64;RequiresRole({ Roles.SUPERVISOR })
 *   &#64;PostMapping("/departments")
 *   public ResponseEntity&lt;?&gt; addDepartment(...)
 * </pre>
 *
 * May be placed on a single method or on the whole controller (the method-level
 * annotation wins). A System admin passes every check — see {@link Roles#isAdmin}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.METHOD, ElementType.TYPE })
public @interface RequiresRole {
    String[] value();
}
