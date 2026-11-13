package com.handsoffretail.reporting.gilbarco.stores.repository;

import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import java.util.List;
import java.util.Optional;

public interface StoreRepository {

    List<StoreRecord> findAll();

    Optional<StoreRecord> findById(long storeId);

    Optional<StoreRecord> findByCode(String storeCode);
}
