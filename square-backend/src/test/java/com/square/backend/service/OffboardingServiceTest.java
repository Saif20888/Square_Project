package com.square.backend.service;

import com.square.backend.model.*;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.OffboardingRepository;
import com.square.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The device-handling side of offboarding — this is where a bug let a device
 * that was out for repair at the moment its owner left silently keep pointing
 * at them, and later get handed straight back by repairReturn().
 */
@ExtendWith(MockitoExtension.class)
class OffboardingServiceTest {

    @Mock private OffboardingRepository offboardingRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssetRepository assetRepository;
    @Mock private NotificationRepository notificationRepository;
    @InjectMocks private OffboardingService service;

    @Captor private ArgumentCaptor<Asset> assetCaptor;
    @Captor private ArgumentCaptor<Notification> notificationCaptor;

    private User employee;

    @BeforeEach
    void setUp() {
        employee = new User("jdoe", "hashed", "EMPLOYEE");
        employee.setId(7L);
        employee.setName("Jane Doe");
        when(offboardingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findByUsername("jdoe")).thenReturn(Optional.of(employee));
    }

    @Test
    void assetOutForRepairIsUnlinkedNotIgnored() {
        Asset inRepair = Asset.builder().id(1L).status(AssetStatus.IN_REPAIR).userId(7L)
                .serialNumber("SL-1").deviceType("Laptop").build();
        when(assetRepository.findByUserId(7L)).thenReturn(List.of(inRepair));

        service.createPlan("jdoe", OffboardingDecision.RELEASE_TO_IT, null);

        // userId must be cleared now, or repairReturn() will re-assign it back to
        // the (now terminated) employee once the device comes back from the shop.
        verify(assetRepository).save(assetCaptor.capture());
        assertNull(assetCaptor.getValue().getUserId());
        assertEquals(AssetStatus.IN_REPAIR, assetCaptor.getValue().getStatus(), "still physically at the shop");

        verify(notificationRepository).save(notificationCaptor.capture());
        assertEquals("REPAIR_OWNER_OFFBOARDED", notificationCaptor.getValue().getType());
    }

    @Test
    void releaseToItMovesAssetToVacantDeskSoAResubmitDoesNotReNotify() {
        Asset inUse = Asset.builder().id(2L).status(AssetStatus.ALLOCATED_IN_USE).userId(7L)
                .serialNumber("SL-2").deviceType("Laptop").build();
        when(assetRepository.findByUserId(7L)).thenReturn(List.of(inUse));

        service.createPlan("jdoe", OffboardingDecision.RELEASE_TO_IT, null);

        verify(assetRepository).save(assetCaptor.capture());
        assertEquals(AssetStatus.VACANT_DESK, assetCaptor.getValue().getStatus());

        verify(notificationRepository).save(notificationCaptor.capture());
        assertEquals("DEVICE_RELEASE", notificationCaptor.getValue().getType());
    }

    @Test
    void assetAlreadyOutOfServiceIsSkippedEntirely() {
        Asset scrapped = Asset.builder().id(3L).status(AssetStatus.SCRAPPED).userId(7L)
                .serialNumber("SL-3").deviceType("Laptop").build();
        when(assetRepository.findByUserId(7L)).thenReturn(List.of(scrapped));

        service.createPlan("jdoe", OffboardingDecision.RETAIN_14_DAY, null);

        verify(assetRepository, never()).save(any());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void employeeIsMarkedOffboarded() {
        when(assetRepository.findByUserId(7L)).thenReturn(List.of());
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.createPlan("jdoe", OffboardingDecision.RETAIN_14_DAY, "leaving the company");

        assertTrue(employee.isOffboarded());
    }
}
