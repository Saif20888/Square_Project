package com.square.backend.controller;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Reads live numbers straight off the beans already running in this app —
 * the HikariCP pool configured in application.yaml and the async executor
 * configured in AsyncConfig. No extra monitoring dependency required.
 */
@RestController
@RequestMapping("/api/admin/health")
@RequiresRole({ Roles.SYSTEM_ADMIN })
public class SystemHealthController {

    @Autowired
    private DataSource dataSource;

    @Autowired
    @Qualifier("taskExecutor")
    private Executor taskExecutor;

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> result = new LinkedHashMap<>();

        if (dataSource instanceof HikariDataSource hikari) {
            HikariPoolMXBean pool = hikari.getHikariPoolMXBean();
            Map<String, Object> db = new LinkedHashMap<>();
            db.put("poolName", hikari.getPoolName());
            db.put("activeConnections", pool.getActiveConnections());
            db.put("idleConnections", pool.getIdleConnections());
            db.put("totalConnections", pool.getTotalConnections());
            db.put("threadsAwaitingConnection", pool.getThreadsAwaitingConnection());
            db.put("maxPoolSize", hikari.getMaximumPoolSize());
            result.put("database", db);
        }

        if (taskExecutor instanceof ThreadPoolTaskExecutor executor) {
            Map<String, Object> async = new LinkedHashMap<>();
            async.put("activeCount", executor.getActiveCount());
            async.put("poolSize", executor.getPoolSize());
            async.put("corePoolSize", executor.getCorePoolSize());
            async.put("maxPoolSize", executor.getMaxPoolSize());
            async.put("queueSize", executor.getThreadPoolExecutor().getQueue().size());
            async.put("queueCapacity", executor.getQueueCapacity());
            async.put("completedTaskCount", executor.getThreadPoolExecutor().getCompletedTaskCount());
            result.put("async", async);
        }

        return result;
    }
}
