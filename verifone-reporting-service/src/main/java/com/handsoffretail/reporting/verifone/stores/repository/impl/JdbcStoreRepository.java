package com.handsoffretail.reporting.verifone.stores.repository.impl;

import com.handsoffretail.reporting.verifone.stores.model.PosVendor;
import com.handsoffretail.reporting.verifone.stores.model.StoreRecord;
import com.handsoffretail.reporting.verifone.stores.repository.StoreRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcStoreRepository implements StoreRepository {

    private static final String SELECT_STORES_SQL = """
            SELECT store_id, store_code, store_name, pos_vendor, timezone, status
            FROM core.stores
            """;

    private static final RowMapper<StoreRecord> ROW_MAPPER = JdbcStoreRepository::mapRow;

    private final NamedParameterJdbcTemplate authDb;

    public JdbcStoreRepository(@Qualifier("authJdbcTemplate") NamedParameterJdbcTemplate authDb) {
        this.authDb = authDb;
    }

    @Override
    public List<StoreRecord> findAll() {
        return authDb.query(SELECT_STORES_SQL + " ORDER BY store_id", ROW_MAPPER);

    }

    @Override
    public Optional<StoreRecord> findById(long storeId) {
        String sql = SELECT_STORES_SQL + " WHERE store_id = :id";
        return authDb.query(sql, new MapSqlParameterSource("id", storeId), ROW_MAPPER).stream().findFirst();

    }

    @Override
    public Optional<StoreRecord> findByCode(String storeCode) {
        if (storeCode == null || storeCode.isBlank()) {
            return Optional.empty();
        }
        String sql = SELECT_STORES_SQL + " WHERE store_code = :code";
        return authDb.query(sql, new MapSqlParameterSource("code", storeCode.trim()), ROW_MAPPER).stream().findFirst();

    }

    private static StoreRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new StoreRecord(
                rs.getLong("store_id"),
                rs.getString("store_code"),
                rs.getString("store_name"),
                PosVendor.parse(rs.getString("pos_vendor")),
                rs.getString("timezone"),
                rs.getString("status"));
    }
}
