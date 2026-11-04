package com.euodoo.hire;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;

/**
 * Euodoo Hire — HR Module Application Entry Point.
 *
 * @EnableMongoAuditing enables @CreatedDate and @LastModifiedDate in documents.
 * @EnableAsync enables asynchronous audit and notification logging.
 * @EnableScheduling enables automated subscription expiry and maintenance tasks.
 */
@SpringBootApplication
@EnableMongoAuditing
@EnableAsync
@EnableScheduling
@EnableSpringDataWebSupport(pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class HireApplication {

    static {
        loadDotEnv();
    }

    public static void main(String[] args) {
        SpringApplication.run(HireApplication.class, args);
    }

    private static void loadDotEnv() {
        String[] possiblePaths = {
            ".env",
            "backend/.env",
            "../backend/.env"
        };
        for (String path : possiblePaths) {
            File file = new File(path);
            if (file.exists() && file.isFile()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(file, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        String key = line.substring(0, eqIdx).trim();
                        String val = line.substring(eqIdx + 1).trim();
                        if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }
                        if (System.getProperty(key) == null || System.getProperty(key).isBlank()) {
                            System.setProperty(key, val);
                        }
                    }
                    System.out.println("[HireApplication] Loaded environment from: " + file.getAbsolutePath());
                    break;
                } catch (Exception e) {
                    System.err.println("[HireApplication] Failed to read .env from " + path + ": " + e.getMessage());
                }
            }
        }
    }
}
