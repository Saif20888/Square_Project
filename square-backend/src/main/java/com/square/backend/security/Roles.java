package com.square.backend.security;

/**
 * The four roles in the portal, and who is allowed to do what.
 *
 * <p>The names here match the {@code role} column on {@code users} and the
 * labels shown in the UI:
 *
 * <ul>
 *   <li>{@link #EMPLOYEE} — "User": raises tickets, registers and views own devices</li>
 *   <li>{@link #IT_TECH} — "IT Team": works tickets and manages the asset lifecycle</li>
 *   <li>{@link #SUPERVISOR} — "Superuser": onboarding, offboarding, org structure, password resets</li>
 *   <li>{@link #SYSTEM_ADMIN} — "System admin": oversight, and emergency access to everything</li>
 * </ul>
 */
public final class Roles {

    private Roles() {}

    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String IT_TECH = "IT_TECH";
    public static final String SUPERVISOR = "SUPERVISOR";
    public static final String SYSTEM_ADMIN = "SYSTEM_ADMIN";

    /** Anyone signed in, whatever their role. */
    public static final String[] ANY = { EMPLOYEE, IT_TECH, SUPERVISOR, SYSTEM_ADMIN };

    /**
     * The System admin is deliberately allowed through every role check.
     * Locking the emergency account out of the screens it may need to fix a
     * problem would be worse than the small extra privilege it holds.
     */
    public static boolean isAdmin(String role) {
        return SYSTEM_ADMIN.equals(role);
    }
}
