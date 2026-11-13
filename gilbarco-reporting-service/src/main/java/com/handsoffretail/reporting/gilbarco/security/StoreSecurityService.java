package com.handsoffretail.reporting.gilbarco.security;

import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.reporting.gilbarco.stores.model.StoreRecord;
import java.util.List;

public interface StoreSecurityService {

    void validateAccess(HorPrincipal principal, long storeId);

    boolean isAuthorized(HorPrincipal principal, long storeId);

    List<StoreRecord> filterAccessibleStores(HorPrincipal principal, List<StoreRecord> stores);
}
