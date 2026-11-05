package com.euodoo.hire.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "agency_documents")
@CompoundIndexes({
    @CompoundIndex(name = "agency_doctype_idx", def = "{'agencyId': 1, 'documentType': 1}")
})
public class AgencyDocument {

    @Id
    private String id;

    @Indexed
    private String agencyId;

    private AgencyDocumentType documentType;

    /** Storage public id - internal Cloudinary or local: prefix. */
    @JsonIgnore
    private String storedPublicId;

    private String secureUrl;

    private String originalFilename;

    private String mimeType;

    private long fileSizeBytes;

    @Builder.Default
    private DocumentVerificationStatus verificationStatus = DocumentVerificationStatus.PENDING;

    private String verifiedByAdminId;

    private String verificationRemarks;

    private Instant verifiedAt;

    private Instant uploadedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
