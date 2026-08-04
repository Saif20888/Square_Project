package com.square.backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PagingTest {

    @Test
    void pageSizeIsClampedSoNobodyCanRequestTheWholeTable() {
        assertEquals(Paging.MAX_SIZE, Paging.request(0, 99_999).getPageSize());
        assertEquals(1, Paging.request(0, 0).getPageSize(), "size must be at least 1");
        assertEquals(1, Paging.request(0, -5).getPageSize());
        assertEquals(50, Paging.request(0, 50).getPageSize());
    }

    @Test
    void negativePageNumbersFallBackToTheFirstPage() {
        assertEquals(0, Paging.request(-3, 10).getPageNumber());
    }

    @Test
    void resultsAreOrderedSoPagesStayStable() {
        var sort = Paging.request(0, 10).getSort();
        assertFalse(sort.isUnsorted(), "unordered paging can repeat or skip rows between pages");
    }

    @Test
    void unpagedResponseIsStillAPlainArray() {
        var response = Paging.all(List.of("a", "b", "c"));

        assertInstanceOf(List.class, response.getBody(), "the frontend reads this as an array");
        assertEquals(3, response.getBody().size());
        assertEquals("3", response.getHeaders().getFirst("X-Total-Count"));
        assertEquals("1", response.getHeaders().getFirst("X-Total-Pages"));
    }

    @Test
    void pagedResponseKeepsTheArrayBodyAndReportsTotalsInHeaders() {
        var page = new PageImpl<>(List.of("a", "b"), PageRequest.of(1, 2), 10);
        var response = Paging.page(page);

        assertEquals(2, response.getBody().size(), "body is the page's items, not a wrapper object");
        assertEquals("10", response.getHeaders().getFirst("X-Total-Count"));
        assertEquals("5", response.getHeaders().getFirst("X-Total-Pages"));
        assertEquals("1", response.getHeaders().getFirst("X-Page"));
    }
}
