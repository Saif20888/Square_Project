package com.square.backend.security;

import com.square.backend.model.User;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TokenStoreTest {

    private User user(String username, String role, long id) {
        User u = new User(username, "hashed", role);
        u.setId(id);
        return u;
    }

    @Test
    void issuedTokensAreUniqueAndUnguessable() {
        TokenStore store = new TokenStore();
        String a = store.issue(user("a", Roles.EMPLOYEE, 1L));
        String b = store.issue(user("a", Roles.EMPLOYEE, 1L));

        assertNotEquals(a, b, "every sign-in must get its own token");
        assertTrue(a.length() >= 40, "token should carry 32 bytes of randomness");
    }

    @Test
    void unknownTokenIsRejected() {
        TokenStore store = new TokenStore();
        assertFalse(store.isValid("not-a-real-token"));
        assertNull(store.sessionFor("not-a-real-token"));
        assertFalse(store.isValid(null));
    }

    @Test
    void revokedTokenStopsWorking() {
        TokenStore store = new TokenStore();
        String token = store.issue(user("a", Roles.EMPLOYEE, 1L));
        assertTrue(store.isValid(token));

        store.revoke(token);
        assertFalse(store.isValid(token));
    }

    @Test
    void changingPasswordRevokesEverySessionForThatAccount() {
        TokenStore store = new TokenStore();
        String laptop = store.issue(user("kamal", Roles.EMPLOYEE, 5L));
        String phone = store.issue(user("kamal", Roles.EMPLOYEE, 5L));
        String other = store.issue(user("nusrat", Roles.EMPLOYEE, 6L));

        store.revokeAllFor("kamal");

        assertFalse(store.isValid(laptop), "other sessions must die with the old password");
        assertFalse(store.isValid(phone));
        assertTrue(store.isValid(other), "unrelated accounts must be untouched");
    }

    @Test
    @SuppressWarnings("unchecked")
    void expiredSessionsAreSweptAway() throws Exception {
        TokenStore store = new TokenStore();
        String fresh = store.issue(user("new", Roles.EMPLOYEE, 1L));
        String stale = store.issue(user("old", Roles.EMPLOYEE, 2L));

        // Backdate one session beyond the 12-hour lifetime
        Field field = TokenStore.class.getDeclaredField("tokens");
        field.setAccessible(true);
        var tokens = (Map<String, TokenStore.Session>) field.get(store);
        var old = tokens.get(stale);
        tokens.put(stale, new TokenStore.Session(old.username(), old.role(), old.userId(),
                Instant.now().minusSeconds(13 * 60 * 60)));

        assertFalse(store.isValid(stale), "a session past its lifetime must not authenticate");

        store.removeExpiredSessions();
        assertEquals(1, store.activeSessionCount(), "the sweep should drop only the expired one");
        assertTrue(store.isValid(fresh));
    }
}
