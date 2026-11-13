package com.handsoffretail.reporting.gilbarco.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.gilbarco.security.impl.StoreSecurityServiceImpl;
import com.handsoffretail.reporting.gilbarco.stores.model.PosVendor;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StoreSecurityServiceImplTest {

    private StoreSecurityService securityService;

    @BeforeEach
    void setUp() {
        securityService = new StoreSecurityServiceImpl();
    }

    @Test
    @DisplayName("Platform Admin with allStores=true can access any store")
    void platformAdminHasAccessToAnyStore() {
        HorPrincipal admin = new HorPrincipal("ADMIN", 1L, "PLATFORM_ADMIN", "Admin User", true, Set.of());
        securityService.validateAccess(admin, 999L);
        assertThat(securityService.isAuthorized(admin, 999L)).isTrue();
    }

    @Test
    @DisplayName("Client user can access assigned store")
    void clientUserCanAccessAssignedStore() {
        HorPrincipal client = new HorPrincipal("STORE_USER", 2L, "CLIENT_USER", "Store Client", false, Set.of(10L, 20L));
        securityService.validateAccess(client, 10L);
        securityService.validateAccess(client, 20L);
        assertThat(securityService.isAuthorized(client, 10L)).isTrue();
    }

    @Test
    @DisplayName("Client user cannot access unassigned store (throws 404 DomainException)")
    void clientUserCannotAccessUnassignedStore() {
        HorPrincipal client = new HorPrincipal("STORE_USER", 2L, "CLIENT_USER", "Store Client", false, Set.of(10L));
        assertThatThrownBy(() -> securityService.validateAccess(client, 99L))
                .isInstanceOf(DomainException.class)
                .hasMessage("Store not found.");
        assertThat(securityService.isAuthorized(client, 99L)).isFalse();
    }

    @Test
    @DisplayName("filterAccessibleStores returns all stores for platform admin")
    void filterStoresForAdmin() {
        HorPrincipal admin = new HorPrincipal("ADMIN", 1L, "PLATFORM_ADMIN", "Admin User", true, Set.of());
        List<StoreRecord> stores = List.of(
                new StoreRecord(1L, "STORE1", "Store 1", PosVendor.GILBARCO, "America/Chicago", "ACTIVE"),
                new StoreRecord(2L, "STORE2", "Store 2", PosVendor.OTHER, "America/New_York", "ACTIVE"));

        List<StoreRecord> filtered = securityService.filterAccessibleStores(admin, stores);
        assertThat(filtered).hasSize(2);
    }

    @Test
    @DisplayName("filterAccessibleStores filters by store IDs for client user")
    void filterStoresForClient() {
        HorPrincipal client = new HorPrincipal("STORE_USER", 2L, "CLIENT_USER", "Store Client", false, Set.of(1L));
        List<StoreRecord> stores = List.of(
                new StoreRecord(1L, "STORE1", "Store 1", PosVendor.GILBARCO, "America/Chicago", "ACTIVE"),
                new StoreRecord(2L, "STORE2", "Store 2", PosVendor.OTHER, "America/New_York", "ACTIVE"));

        List<StoreRecord> filtered = securityService.filterAccessibleStores(client, stores);
        assertThat(filtered).hasSize(1);
        assertThat(filtered.get(0).storeId()).isEqualTo(1L);
    }
}
