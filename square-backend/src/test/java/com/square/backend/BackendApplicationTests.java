package com.square.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boots the whole application against the in-memory H2 database. This catches
 * the class of mistake that only appears at wiring time — a missing bean, a
 * bad @Value, an interceptor that cannot be constructed.
 */
@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
