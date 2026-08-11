package com.square.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Single source of truth for password hashing — three controllers used to each
 * instantiate their own {@code BCryptPasswordEncoder}, and had already silently
 * drifted to two different cost factors (8 and 10) without anyone deciding that.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
