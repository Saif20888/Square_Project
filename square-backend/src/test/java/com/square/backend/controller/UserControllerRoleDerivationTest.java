package com.square.backend.controller;

import com.square.backend.security.Roles;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Onboarding's role-derivation rule decides who gets IT_TECH — a role with
 * real authority over repair/loan/receive endpoints — so it's pinned here
 * against silent breakage on refactor. The surprising case is the last one:
 * being in a department merely *named* "IT" grants nothing by itself.
 */
class UserControllerRoleDerivationTest {

    @Test
    void unitOnlyExistsWithinHrAndAdmin() {
        assertEquals("IT", UserController.deriveUnit("HR and Admin", "IT"));
        assertNull(UserController.deriveUnit("Finance", "IT"));
    }

    @Test
    void itUnitWithinHrAndAdminGrantsItTech() {
        String unit = UserController.deriveUnit("HR and Admin", "IT");
        assertEquals(Roles.IT_TECH, UserController.deriveRole(unit, null));
    }

    @Test
    void explicitItTeamEmployeeTypeGrantsItTechRegardlessOfDepartment() {
        assertEquals(Roles.IT_TECH, UserController.deriveRole(null, "IT Team"));
    }

    @Test
    void aDepartmentJustNamedItGrantsNothingOnItsOwn() {
        // Only "HR and Admin" department + "IT" unit, or an explicit "IT Team"
        // employeeType, should ever produce IT_TECH — a department that happens
        // to be named "IT" outside that path must not.
        String unit = UserController.deriveUnit("IT", "IT");
        assertNull(unit);
        assertEquals(Roles.EMPLOYEE, UserController.deriveRole(unit, null));
    }

    @Test
    void everyoneElseIsAPlainEmployee() {
        assertEquals(Roles.EMPLOYEE, UserController.deriveRole(null, null));
        assertEquals(Roles.EMPLOYEE, UserController.deriveRole("HR", "Regular"));
    }
}
