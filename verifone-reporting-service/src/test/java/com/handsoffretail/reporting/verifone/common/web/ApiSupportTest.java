package com.handsoffretail.reporting.verifone.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class ApiSupportTest {

    @Test
    @DisplayName("respond with JSON format by default")
    void respondJson() {
        List<Map<String, Object>> rows = List.of(Map.of("key", "value"));
        ResponseEntity<?> resp = ApiSupport.respond(rows, null, "test");
        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody()).isEqualTo(rows);
    }

    @Test
    @DisplayName("respond with CSV format when format=csv, includes UTF-8 BOM")
    void respondCsv() {
        List<Map<String, Object>> rows = List.of(
                Map.of("store", "8730", "total", "100.50"),
                Map.of("store", "800", "total", "200.00"));
        ResponseEntity<?> resp = ApiSupport.respond(rows, "csv", "test-report");

        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getHeaders().getContentType().toString()).contains("text/csv");
        assertThat(resp.getHeaders().getFirst("Content-Disposition")).contains("test-report.csv");

        String csv = (String) resp.getBody();
        assertThat(csv).startsWith("\uFEFF"); // UTF-8 BOM for Excel
        assertThat(csv).contains("store").contains("total");
        assertThat(csv).contains("8730").contains("100.50");
        assertThat(csv).contains("800").contains("200.00");
    }

    @Test
    @DisplayName("CSV escaping escapes quotes and commas correctly")
    void csvEscaping() {
        List<Map<String, Object>> rows = List.of(
                Map.of("name", "Store, \"Super\""));
        ResponseEntity<?> resp = ApiSupport.respond(rows, "csv", "test");
        String csv = (String) resp.getBody();
        assertThat(csv).contains("\"Store, \"\"Super\"\"\"");
    }
}
