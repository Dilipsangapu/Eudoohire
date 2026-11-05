package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.DocumentVerificationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentVerificationRequest {

    @NotNull(message = "Verification status is required")
    private DocumentVerificationStatus status;

    private String remarks;
}
