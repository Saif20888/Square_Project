package com.square.backend.config; // Added .backend here

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
@EnableScheduling   // drives TokenStore's expired-session sweep
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);       
        executor.setMaxPoolSize(50);        
        executor.setQueueCapacity(500);     
        executor.setThreadNamePrefix("SquareAsync-");
        executor.initialize();
        return executor;
    }
}