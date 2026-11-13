package com.handsoffretail.reporting.verifone.security.impl;

import com.handsoffretail.auth.client.HorPrincipal;
import com.handsoffretail.auth.client.StoreAccess;
import com.handsoffretail.reporting.verifone.security.StoreSecurityService;
import com.handsoffretail.reporting.verifone.stores.model.StoreRecord;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class StoreSecurityServiceImpl implements StoreSecurityService {

    @Override
    public void validateAccess(HorPrincipal principal, long storeId) {
        if (principal == null) {
            throw new IllegalArgumentException("Principal cannot be null");
        }
        StoreAccess.requireStore(principal, storeId);
    }

    @Override
    public boolean isAuthorized(HorPrincipal principal, long storeId) {
        if (principal == null) {
            return false;
        }
        return principal.allStores() || principal.storeIds().contains(storeId);
    }

    @Override
    public List<StoreRecord> filterAccessibleStores(HorPrincipal principal, List<StoreRecord> stores) {
        if (principal == null || stores == null) {
            return List.of();
        }
        if (principal.allStores()) {
            return stores;
        }
        return stores.stream()
                .filter(s -> principal.storeIds().contains(s.storeId()))
                .toList();
    }
}
