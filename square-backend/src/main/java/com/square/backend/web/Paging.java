package com.square.backend.web;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;

import java.util.List;

/**
 * Opt-in pagination that does not change the shape of a response.
 *
 * The list endpoints have always returned a plain JSON array and the frontend
 * reads them as one. Wrapping the result in {"content": [...], "totalPages": n}
 * would have been the conventional choice, but it would break every existing
 * caller. So the body stays an array either way and the totals travel in
 * headers: pass {@code ?page=0&size=50} to page, omit it to get everything.
 */
public final class Paging {

    private Paging() {}

    /** Hard ceiling on page size, so a caller cannot ask for the whole table at once. */
    public static final int MAX_SIZE = 500;
    public static final int DEFAULT_SIZE = 100;

    /** Stable ordering — without it, rows can repeat or vanish between pages. */
    public static PageRequest request(Integer page, Integer size) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        return PageRequest.of(p, s, Sort.by("id").ascending());
    }

    /** Whole list, no paging requested. Totals still reported for consistency. */
    public static <T> ResponseEntity<List<T>> all(List<T> items) {
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(items.size()))
                .header("X-Total-Pages", "1")
                .header("X-Page", "0")
                .body(items);
    }

    /** One page. Body is still a bare array; the counts are in the headers. */
    public static <T> ResponseEntity<List<T>> page(Page<T> page) {
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(page.getTotalElements()))
                .header("X-Total-Pages", String.valueOf(page.getTotalPages()))
                .header("X-Page", String.valueOf(page.getNumber()))
                .body(page.getContent());
    }
}
