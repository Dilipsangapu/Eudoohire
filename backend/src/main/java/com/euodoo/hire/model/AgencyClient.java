package com.euodoo.hire.model;

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
@Document(collection = "agency_clients")
@CompoundIndexes({
    @CompoundIndex(name = "agency_client_company_idx", def = "{'agencyId': 1, 'companyName': 1}"),
    @CompoundIndex(name = "agency_status_idx", def = "{'agencyId': 1, 'status': 1}")
})
public class AgencyClient {

    @Id
    private String id;

    @Indexed
    private String agencyId;

    /** Reference to platform Company document if linked. */
    @Indexed
    private String companyId;

    private String companyName;

    private String industry;

    private String website;

    private String officialEmail;

    private String contactPerson;

    private String contactNumber;

    private String address;

    private String country;

    private String state;

    private String city;

    private String pinCode;

    @Builder.Default
    private AgencyClientStatus status = AgencyClientStatus.ACTIVE;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
