package com.square.backend.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/**
 * Turns every uncaught exception into a small, safe JSON body.
 *
 * Without this, an unexpected error returns Spring's default error page
 * including the exception type and stack trace, which tells an attacker about
 * the internals. Here the real cause is written to the server log and the
 * client only receives a generic message.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /** Thrown by controllers for input the user can fix — the message IS shown. */
    public static class BadRequestException extends RuntimeException {
        public BadRequestException(String message) { super(message); }
    }

    private static ResponseEntity<Map<String, String>> body(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(BadRequestException ex) {
        return body(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /** @Valid failures — report the first field error in plain language. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleInvalid(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream().findFirst()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .orElse("Some of the details sent were not valid.");
        return body(HttpStatus.BAD_REQUEST, msg);
    }

    /** Malformed JSON, wrong types in the URL, missing query parameters. */
    @ExceptionHandler({ HttpMessageNotReadableException.class,
                        MethodArgumentTypeMismatchException.class,
                        MissingServletRequestParameterException.class })
    public ResponseEntity<Map<String, String>> handleMalformed(Exception ex) {
        log.warn("Malformed request: {}", ex.getMessage());
        return body(HttpStatus.BAD_REQUEST, "The request was not in the expected format.");
    }

    /** No such route, or no such static resource — a 404, not a server fault. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoResourceFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "Not found.");
    }

    /** Right path, wrong verb. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> handleWrongMethod(HttpRequestMethodNotSupportedException ex) {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "That method is not allowed here.");
    }

    /**
     * Anything unforeseen: log the detail, tell the client nothing specific.
     *
     * Spring's own MVC exceptions all implement {@link ErrorResponse} and
     * already carry the right status. Without this check the catch-all would
     * relabel them — a missing route would be reported as a server fault,
     * which sends anyone debugging it looking in the wrong place.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        if (ex instanceof ErrorResponse err) {
            HttpStatus status = HttpStatus.resolve(err.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                log.warn("Client error {}: {}", status.value(), ex.getMessage());
                return body(status, status == HttpStatus.NOT_FOUND
                        ? "Not found." : "The request could not be processed.");
            }
        }
        log.error("Unhandled error while serving a request", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again.");
    }
}
