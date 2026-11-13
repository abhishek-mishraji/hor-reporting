package com.handsoffretail.reporting.verifone.stores;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.reporting.verifone.stores.model.PosVendor;
import com.handsoffretail.reporting.verifone.stores.model.StoreRecord;
import com.handsoffretail.reporting.verifone.stores.repository.StoreRepository;
import com.handsoffretail.reporting.verifone.stores.service.StoreDirectoryService;
import com.handsoffretail.reporting.verifone.stores.service.impl.StoreDirectoryServiceImpl;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StoreDirectoryServiceImplTest {

    private StoreRepository repository;
    private StoreDirectoryService service;

    private final StoreRecord store1 = new StoreRecord(1L, "TIKI_8730", "Tiki Hut", PosVendor.VERIFONE, "America/New_York", "ACTIVE");
    private final StoreRecord store2 = new StoreRecord(2L, "OTHER_800", "Other Stop", PosVendor.OTHER, "America/Chicago", "ACTIVE");

    @BeforeEach
    void setUp() {
        repository = mock(StoreRepository.class);
        service = new StoreDirectoryServiceImpl(repository);
    }

    @Test
    @DisplayName("getAllStores returns all stores from repository")
    void getAllStores() {
        when(repository.findAll()).thenReturn(List.of(store1, store2));
        List<StoreRecord> all = service.getAllStores();
        assertThat(all).containsExactly(store1, store2);
    }

    @Test
    @DisplayName("resolveStore by numeric store ID")
    void resolveByNumericId() {
        when(repository.findById(1L)).thenReturn(Optional.of(store1));
        StoreRecord result = service.resolveStore("1");
        assertThat(result).isEqualTo(store1);
    }

    @Test
    @DisplayName("resolveStore by store code")
    void resolveByStoreCode() {
        when(repository.findByCode("OTHER_800")).thenReturn(Optional.of(store2));
        StoreRecord result = service.resolveStore("OTHER_800");
        assertThat(result).isEqualTo(store2);
    }

    @Test
    @DisplayName("resolveStore throws 404 when store not found")
    void resolveNotFound() {
        when(repository.findByCode("UNKNOWN")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resolveStore("UNKNOWN"))
                .isInstanceOf(DomainException.class)
                .hasMessage("Store not found.");
    }
}
