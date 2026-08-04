package com.square.backend.web;

import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.junit.jupiter.api.Assertions.*;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void badRequestKeepsItsMessageBecauseTheUserCanActOnIt() {
        var response = handler.handleBadRequest(new BadRequestException("E-mail is required."));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("E-mail is required.", response.getBody().get("message"));
    }

    @Test
    void unexpectedFailuresRevealNothingAboutTheInternals() {
        var response = handler.handleUnexpected(
                new IllegalStateException("connection to 10.0.0.5 as square_app failed"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        String message = response.getBody().get("message");
        assertFalse(message.contains("10.0.0.5"), "must not leak infrastructure detail");
        assertFalse(message.contains("square_app"), "must not leak credentials or usernames");
        assertFalse(message.toLowerCase().contains("exception"));
    }

    /**
     * Regression: the catch-all handler used to relabel Spring's own 404 as a
     * 500, so a mistyped URL looked like a server fault and sent anyone
     * debugging it looking in the wrong place.
     */
    @Test
    void missingRouteIsReportedAsNotFoundNotAsServerError() {
        var missing = new NoResourceFoundException(HttpMethod.GET, "/api/does-not-exist", "does-not-exist");

        assertEquals(HttpStatus.NOT_FOUND, handler.handleNotFound(missing).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, handler.handleUnexpected(missing).getStatusCode(),
                "even through the catch-all, a 404 must stay a 404");
    }

    @Test
    void wrongHttpMethodIsReportedAsMethodNotAllowed() {
        var wrongVerb = new HttpRequestMethodNotSupportedException("DELETE");

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, handler.handleWrongMethod(wrongVerb).getStatusCode());
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, handler.handleUnexpected(wrongVerb).getStatusCode());
    }
}
