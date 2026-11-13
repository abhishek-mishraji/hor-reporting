package com.handsoffretail.reporting.verifone.stores.service.impl;

import com.handsoffretail.auth.client.CommonErrorCode;
import com.handsoffretail.auth.client.DomainException;
import com.handsoffretail.reporting.verifone.stores.model.StoreRecord;
import com.handsoffretail.reporting.verifone.stores.repository.StoreRepository;
import com.handsoffretail.reporting.verifone.stores.service.StoreDirectoryService;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StoreDirectoryServiceImpl implements StoreDirectoryService {

    private final StoreRepository storeRepository;

    public StoreDirectoryServiceImpl(StoreRepository storeRepository) {
        this.storeRepository = storeRepository;
    }

    @Override
    public List<StoreRecord> getAllStores() {
        return storeRepository.findAll();
    }

    @Override
    public Optional<StoreRecord> getStoreById(long storeId) {
        return storeRepository.findById(storeId);
    }

    @Override
    public Optional<StoreRecord> getStoreByCode(String storeCode) {
        return storeRepository.findByCode(storeCode);
    }

    @Override
    public StoreRecord resolveStore(String storeCodeOrId) {
        if (storeCodeOrId == null || storeCodeOrId.isBlank()) {
            throw new DomainException(CommonErrorCode.NOT_FOUND, "Store not found.");
        }
        String query = storeCodeOrId.trim();

        // Check if query is numeric store ID
        if (query.matches("^\\d+$")) {
            long storeId = Long.parseLong(query);
            Optional<StoreRecord> byId = storeRepository.findById(storeId);
            if (byId.isPresent()) {
                return byId.get();
            }
        }

        // Check by store code
        return storeRepository.findByCode(query)
                .orElseThrow(() -> new DomainException(CommonErrorCode.NOT_FOUND, "Store not found."));
    }
}
