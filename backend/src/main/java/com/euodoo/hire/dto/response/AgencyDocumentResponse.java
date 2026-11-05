package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.model.DocumentVerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyDocumentResponse {

    private String id;
    private String agencyId;
    private AgencyDocumentType documentType;
    private String secureUrl;
    private String originalFilename;
    private String mimeType;
    private long fileSizeBytes;
    private DocumentVerificationStatus verificationStatus;
    private String verifiedByAdminId;
    private String verificationRemarks;
    private Instant verifiedAt;
    private Instant uploadedAt;
}
