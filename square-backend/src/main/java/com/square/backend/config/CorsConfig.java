package com.square.backend.config;

import com.square.backend.security.RoleInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * Single source of truth for which browser origins may call this API.
 *
 * Previously every controller carried its own hardcoded
 * {@code @CrossOrigin("http://localhost:5173")}, which meant a deployment to a
 * real domain silently broke the frontend in nine places. The allowed origins
 * now come from the {@code square.cors.allowed-origins} property, which reads
 * the CORS_ORIGINS environment variable in production.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(@Value("${square.cors.allowed-origins}") String origins) {
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /** Exposed so AuthTokenFilter can echo the same origins on its 401 responses. */
    @Bean
    public CorsOrigins corsOrigins() {
        return new CorsOrigins(allowedOrigins);
    }

    @Autowired
    private RoleInterceptor roleInterceptor;

    /** Turns @RequiresRole on controller methods into real server-side checks. */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(roleInterceptor).addPathPatterns("/api/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                // Browsers hide non-standard response headers unless listed here,
                // so paging totals would be invisible to the frontend without this
                .exposedHeaders("X-Total-Count", "X-Total-Pages", "X-Page")
                .maxAge(3600);
    }

    /** Simple holder so other components can ask "is this origin allowed?". */
    public record CorsOrigins(List<String> values) {
        public boolean isAllowed(String origin) {
            return origin != null && values.contains(origin);
        }
    }
}
