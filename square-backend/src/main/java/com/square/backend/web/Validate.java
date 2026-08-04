package com.square.backend.web;

import com.square.backend.web.ApiExceptionHandler.BadRequestException;

import java.security.SecureRandom;

/**
 * Small input guards for the request bodies that arrive as raw maps.
 *
 * Each method throws {@link BadRequestException}, which ApiExceptionHandler
 * turns into a 400 with the given message, so controllers stay readable.
 */
public final class Validate {

    private Validate() {}

    /** Longest value accepted for a normal text field — keeps oversized bodies out of the DB. */
    public static final int MAX_TEXT = 120;
    public static final int MIN_PASSWORD = 8;

    public static String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(label + " is required.");
        }
        return value.trim();
    }

    /** Required, trimmed, and not absurdly long. */
    public static String requiredText(String value, String label) {
        String v = required(value, label);
        if (v.length() > MAX_TEXT) {
            throw new BadRequestException(label + " must be " + MAX_TEXT + " characters or fewer.");
        }
        return v;
    }

    /** Optional field — still length-capped when present. */
    public static String optionalText(String value, String label) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (v.length() > MAX_TEXT) {
            throw new BadRequestException(label + " must be " + MAX_TEXT + " characters or fewer.");
        }
        return v;
    }

    public static String password(String value, String label) {
        String v = required(value, label);
        if (v.length() < MIN_PASSWORD) {
            throw new BadRequestException(label + " must be at least " + MIN_PASSWORD + " characters long.");
        }
        return v;
    }

    /** Good enough check that this looks like an e-mail address. */
    public static String email(String value, String label) {
        String v = requiredText(value, label);
        if (!v.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new BadRequestException("Enter a valid e-mail address.");
        }
        return v;
    }

    // --- Temporary passwords -------------------------------------------------
    // Drawn from a SecureRandom over a 58-character alphabet (no look-alike
    // characters like O/0 or l/1). The old format was "TempPass" + three digits,
    // which an attacker could guess in at most 900 tries.
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public static String temporaryPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }
}
