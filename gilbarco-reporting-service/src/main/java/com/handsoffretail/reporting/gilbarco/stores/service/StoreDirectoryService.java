package com.handsoffretail.reporting.gilbarco.stores.service;

import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import java.util.List;
import java.util.Optional;

public interface StoreDirectoryService {

    List<StoreRecord> getAllStores();

    Optional<StoreRecord> getStoreById(long storeId);

    Optional<StoreRecord> getStoreByCode(String storeCode);

    StoreRecord resolveStore(String storeCodeOrId);
}
