package com.square.backend.security;

import com.square.backend.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The authorization rules, tested directly against the interceptor.
 *
 * These are the tests that would have caught the privilege-escalation hole:
 * before {@link RoleInterceptor} existed, any signed-in employee could reach
 * the Superuser and admin endpoints because the only role check lived in the
 * React UI.
 */
class RoleInterceptorTest {

    private final RoleInterceptor interceptor = new RoleInterceptor();

    // A stand-in controller carrying the same annotations the real ones use.
    @SuppressWarnings("unused")
    static class SampleController {
        public void openToAnyone() {}

        @RequiresRole({ Roles.SUPERVISOR })
        public void supervisorOnly() {}

        @RequiresRole({ Roles.IT_TECH })
        public void technicianOnly() {}

        @RequiresRole({ Roles.SYSTEM_ADMIN })
        public void adminOnly() {}

        @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
        public void techOrSupervisor() {}
    }

    /** Runs one request through the interceptor and reports whether it was allowed. */
    private boolean allows(String methodName, String role) throws Exception {
        Method method = SampleController.class.getMethod(methodName);
        HandlerMethod handler = new HandlerMethod(new SampleController(), method);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/probe");
        if (role != null) {
            request.setAttribute(CurrentUser.ATTRIBUTE,
                    new TokenStore.Session("someone", role, 1L, Instant.now()));
        }
        return interceptor.preHandle(request, new MockHttpServletResponse(), handler);
    }

    private int statusFor(String methodName, String role) throws Exception {
        Method method = SampleController.class.getMethod(methodName);
        HandlerMethod handler = new HandlerMethod(new SampleController(), method);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/probe");
        if (role != null) {
            request.setAttribute(CurrentUser.ATTRIBUTE,
                    new TokenStore.Session("someone", role, 1L, Instant.now()));
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        interceptor.preHandle(request, response, handler);
        return response.getStatus();
    }

    @Test
    void unannotatedEndpointIsOpenToEverySignedInRole() throws Exception {
        for (String role : Roles.ANY) {
            assertTrue(allows("openToAnyone", role), role + " should reach an unrestricted endpoint");
        }
    }

    @Test
    void employeeIsBlockedFromSupervisorEndpoints() throws Exception {
        assertFalse(allows("supervisorOnly", Roles.EMPLOYEE));
        assertEquals(403, statusFor("supervisorOnly", Roles.EMPLOYEE));
    }

    @Test
    void employeeIsBlockedFromAdminEndpoints() throws Exception {
        assertFalse(allows("adminOnly", Roles.EMPLOYEE));
        assertEquals(403, statusFor("adminOnly", Roles.EMPLOYEE));
    }

    @Test
    void technicianIsBlockedFromSupervisorEndpoints() throws Exception {
        assertFalse(allows("supervisorOnly", Roles.IT_TECH));
    }

    @Test
    void supervisorIsBlockedFromTechnicianOnlyEndpoints() throws Exception {
        assertFalse(allows("technicianOnly", Roles.SUPERVISOR));
    }

    @Test
    void eachRoleReachesItsOwnEndpoints() throws Exception {
        assertTrue(allows("supervisorOnly", Roles.SUPERVISOR));
        assertTrue(allows("technicianOnly", Roles.IT_TECH));
        assertTrue(allows("techOrSupervisor", Roles.IT_TECH));
        assertTrue(allows("techOrSupervisor", Roles.SUPERVISOR));
    }

    @Test
    void systemAdminPassesEveryCheck() throws Exception {
        assertTrue(allows("supervisorOnly", Roles.SYSTEM_ADMIN));
        assertTrue(allows("technicianOnly", Roles.SYSTEM_ADMIN));
        assertTrue(allows("adminOnly", Roles.SYSTEM_ADMIN));
    }

    @Test
    void requestWithNoSessionIsRejectedAsUnauthenticated() throws Exception {
        assertFalse(allows("supervisorOnly", null));
        assertEquals(401, statusFor("supervisorOnly", null));
    }

    @Test
    void sessionCarriesTheRoleCapturedAtSignIn() {
        User user = new User("someone", "hashed", Roles.IT_TECH);
        user.setId(42L);
        TokenStore store = new TokenStore();
        String token = store.issue(user);

        TokenStore.Session session = store.sessionFor(token);
        assertNotNull(session);
        assertEquals(Roles.IT_TECH, session.role());
        assertEquals(42L, session.userId());
        assertEquals("someone", session.username());
    }
}
