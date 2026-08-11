package com.square.backend.service;

import com.square.backend.model.AuditEvent;
import com.square.backend.repository.AuditEventRepository;
import com.square.backend.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Records privileged actions to the audit trail.
 *
 * The actor is always taken from the signed-in session, never from anything the
 * caller sent, so an audit entry cannot be forged by posting a different name.
 *
 * Auditing must never be the reason a legitimate action fails, so a failure to
 * write the record is logged and swallowed rather than propagated.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    // Action names, kept together so they stay consistent and greppable
    public static final String PASSWORD_RESET = "PASSWORD_RESET";
    public static final String PASSWORD_CHANGED = "PASSWORD_CHANGED";
    public static final String EMPLOYEE_ONBOARDED = "EMPLOYEE_ONBOARDED";
    public static final String PROFILE_UPDATED = "PROFILE_UPDATED";
    public static final String ASSET_SCRAPPED = "ASSET_SCRAPPED";
    public static final String ASSET_ASSIGNED = "ASSET_ASSIGNED";
    public static final String ASSET_REGISTERED = "ASSET_REGISTERED";
    public static final String ASSET_LOANED = "ASSET_LOANED";
    public static final String ASSET_SENT_TO_REPAIR = "ASSET_SENT_TO_REPAIR";
    public static final String ASSET_REPAIR_RETURNED = "ASSET_REPAIR_RETURNED";
    public static final String ASSET_WARRANTY_REPLACED = "ASSET_WARRANTY_REPLACED";
    public static final String ASSET_RECEIVED = "ASSET_RECEIVED";
    public static final String ASSET_ASSIGN_REQUESTED = "ASSET_ASSIGN_REQUESTED";
    public static final String ASSET_ASSIGN_DECIDED = "ASSET_ASSIGN_DECIDED";
    public static final String OFFBOARDING_SUBMITTED = "OFFBOARDING_SUBMITTED";
    public static final String ORG_CHANGED = "ORG_CHANGED";
    public static final String TICKET_RESOLVED = "TICKET_RESOLVED";

    @Autowired
    private AuditEventRepository repository;

    public void record(String action, String target, String detail) {
        try {
            var session = CurrentUser.session();
            repository.save(AuditEvent.builder()
                    .actorUsername(session == null ? "system" : session.username())
                    .actorRole(session == null ? null : session.role())
                    .action(action)
                    .target(target)
                    .detail(detail == null ? null : detail.substring(0, Math.min(detail.length(), 500)))
                    .at(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("Could not write audit event {} on {}", action, target, e);
        }
    }
}
