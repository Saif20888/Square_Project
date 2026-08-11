package com.square.backend.web;

import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ValidateTest {

    @Test
    void requiredRejectsNullAndBlank() {
        assertThrows(BadRequestException.class, () -> Validate.required(null, "Name"));
        assertThrows(BadRequestException.class, () -> Validate.required("", "Name"));
        assertThrows(BadRequestException.class, () -> Validate.required("   ", "Name"));
        assertEquals("Rafiq", Validate.required("  Rafiq  ", "Name"), "value should come back trimmed");
    }

    @Test
    void textIsLengthCapped() {
        String tooLong = "x".repeat(Validate.MAX_TEXT + 1);
        assertThrows(BadRequestException.class, () -> Validate.requiredText(tooLong, "Office name"));
        assertDoesNotThrow(() -> Validate.requiredText("x".repeat(Validate.MAX_TEXT), "Office name"));
    }

    @Test
    void optionalTextAllowsAbsenceButStillCapsLength() {
        assertNull(Validate.optionalText(null, "Employee ID"));
        assertNull(Validate.optionalText("  ", "Employee ID"));
        assertEquals("SQ-1", Validate.optionalText(" SQ-1 ", "Employee ID"));
        assertThrows(BadRequestException.class,
                () -> Validate.optionalText("x".repeat(Validate.MAX_TEXT + 1), "Employee ID"));
    }

    @Test
    void emailShapeIsChecked() {
        assertThrows(BadRequestException.class, () -> Validate.email("not-an-email", "E-mail"));
        assertThrows(BadRequestException.class, () -> Validate.email("missing@domain", "E-mail"));
        assertThrows(BadRequestException.class, () -> Validate.email("two@@at.com", "E-mail"));
        assertDoesNotThrow(() -> Validate.email("rafiq@squaregroup.com", "E-mail"));
    }

    @Test
    void temporaryPasswordsAreLongAndNotRepeated() {
        // The old scheme was "TempPass" + three digits — 900 possibilities.
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            String pw = Validate.temporaryPassword();
            assertEquals(12, pw.length());
            assertFalse(pw.startsWith("TempPass"), "must not use the old guessable format");
            seen.add(pw);
        }
        assertTrue(seen.size() > 495, "temporary passwords must not collide in practice");
    }
}
