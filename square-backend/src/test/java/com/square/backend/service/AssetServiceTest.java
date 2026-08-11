package com.square.backend.service;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * The asset lifecycle transitions had no state guard at all before this —
 * every method would fire regardless of the asset's current status. These
 * pin the guards down so a future change can't silently drop one again.
 */
@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock private AssetRepository assetRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private AssetService service;

    private Asset asset(AssetStatus status) {
        return Asset.builder().id(1L).status(status).serialNumber("SL-1").deviceType("Laptop").build();
    }

    @BeforeEach
    void stubSave() {
        lenient().when(assetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(userRepository.existsById(anyLong())).thenReturn(true);
    }

    @Test
    void reassigningDirectlyClearsStaleLoanerState() {
        // A loaner, currently with employee A, handed straight to employee B
        // without a stop in the pool — B should not inherit A's loaner flag.
        Asset a = asset(AssetStatus.ALLOCATED_IN_USE);
        a.setLoaner(true);
        a.setLoanerIssuedAt(LocalDate.now().minusDays(3));
        when(assetRepository.findById(1L)).thenReturn(Optional.of(a));

        Asset result = service.assign(1L, 99L);

        assertEquals(99L, result.getUserId());
        assertFalse(result.isLoaner());
        assertNull(result.getLoanerIssuedAt());
    }

    @Test
    void cannotLoanOutADeviceCurrentlyAtTheRepairShop() {
        when(assetRepository.findById(1L)).thenReturn(Optional.of(asset(AssetStatus.IN_REPAIR)));
        assertThrows(ConflictException.class, () -> service.loan(1L, 5L));
    }

    @Test
    void requestingAssignmentOfADeviceAlreadyHeldIsRejected() {
        when(assetRepository.findById(1L)).thenReturn(Optional.of(asset(AssetStatus.ALLOCATED_IN_USE)));
        assertThrows(ConflictException.class, () -> service.requestAssign(1L, 5L));
    }

    @Test
    void approvingAnAssignmentThatIsNotPendingIsRejected() {
        // Guards the double-click / retry case: once the first approval clears
        // pendingUserId and moves the asset on, a second call must not silently
        // re-pool a device that's already been handed to someone.
        when(assetRepository.findById(1L)).thenReturn(Optional.of(asset(AssetStatus.ALLOCATED_IN_USE)));
        assertThrows(ConflictException.class, () -> service.approveAssign(1L, true));
    }

    @Test
    void approvingAPendingAssignmentHandsOverTheDevice() {
        Asset a = asset(AssetStatus.UNDER_REVIEW);
        a.setPendingUserId(42L);
        when(assetRepository.findById(1L)).thenReturn(Optional.of(a));

        Asset result = service.approveAssign(1L, true);

        assertEquals(AssetStatus.ALLOCATED_IN_USE, result.getStatus());
        assertEquals(42L, result.getUserId());
        assertNull(result.getPendingUserId());
    }

    @Test
    void assigningToAUserThatDoesNotExistIsRejected() {
        when(assetRepository.findById(1L)).thenReturn(Optional.of(asset(AssetStatus.AVAILABLE_IN_POOL)));
        when(userRepository.existsById(404L)).thenReturn(false);
        assertThrows(BadRequestException.class, () -> service.assign(1L, 404L));
    }

    @Test
    void receivingADeviceAlreadyInThePoolIsRejected() {
        when(assetRepository.findById(1L)).thenReturn(Optional.of(asset(AssetStatus.AVAILABLE_IN_POOL)));
        assertThrows(ConflictException.class, () -> service.receive(1L, "IT Closet"));
    }
}
