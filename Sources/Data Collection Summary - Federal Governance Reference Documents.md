# Data Collection Summary - Federal Governance Reference Documents

## Overview

This document summarizes all reference documents and data files successfully retrieved and structured for the MacTech Federal Contract Governance & Risk Management Platform Cursor project.

## Successfully Retrieved Documents

### 1. FAR (Federal Acquisition Regulation)
- **Source:** https://www.acquisition.gov/far/part-52
- **Status:** ✅ Complete
- **Content:** Full text of FAR Part 52 (Solicitation Provisions and Contract Clauses)
- **Size:** 2.2 MB markdown text
- **Location:** `/home/ubuntu/page_texts/www.acquisition.gov_far_part-52.md`
- **Structured Data:** `/home/ubuntu/far_clauses_sample.csv` (50 clauses extracted as sample)

### 2. DFARS (Defense Federal Acquisition Regulation Supplement)
- **Source:** https://www.acquisition.gov/dfars/part-252-solicitation-provisions-and-contract-clauses
- **Status:** ✅ Complete
- **Content:** Full text of DFARS Part 252 (Solicitation Provisions and Contract Clauses)
- **Size:** 1.5 MB markdown text
- **Location:** `/home/ubuntu/page_texts/www.acquisition.gov_dfars_part-252-solicitation-provisions-and-contract-clauses.md`
- **Structured Data:** `/home/ubuntu/dfars_clauses_sample.csv` (50 clauses extracted as sample)
- **Key Clauses Included:**
  - DFARS 252.204-7012 (Safeguarding Covered Defense Information and Cyber Incident Reporting)
  - DFARS 252.204-7021 (Contractor Compliance With CMMC Level Requirements)

### 3. NIST SP 800-171 Rev 2
- **Source:** https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-171r2.pdf
- **Status:** ✅ Downloaded
- **Content:** Protecting Controlled Unclassified Information in Nonfederal Systems and Organizations
- **Size:** 1.5 MB (114 pages)
- **Location:** `/home/ubuntu/Downloads/NIST_SP_800-171_Rev2.pdf`
- **Structured Data:** `/home/ubuntu/nist_800_171_controls.csv` (All 110 Level 2 controls)
- **Note:** This version was superseded by Rev 3 in May 2024, but Rev 2 is still the basis for CMMC Level 2

### 4. NIST SP 800-53 Rev 5
- **Source:** https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf
- **Status:** ✅ Downloaded
- **Content:** Security and Privacy Controls for Information Systems and Organizations
- **Size:** 5.8 MB (458 pages)
- **Location:** `/home/ubuntu/Downloads/NIST_SP_800-53_Rev5.pdf`
- **Purpose:** Comprehensive security control catalog for mapping to CMMC and organizational security programs

## Structured Data Files Created

### 1. FAR Clauses Library (`far_clauses_sample.csv`)
**Fields:**
- clause_number
- title
- regulation
- full_text_url
- risk_category
- risk_level
- description
- flow_down_required
- applicability_notes

**Sample Count:** 50 clauses
**Full Extraction:** Can be expanded to include all FAR Part 52 clauses

### 2. DFARS Clauses Library (`dfars_clauses_sample.csv`)
**Fields:** Same as FAR
**Sample Count:** 50 clauses
**Key High-Risk Clauses Flagged:**
- 252.204-7012 (Risk Level 4 - Cyber Security)
- 252.204-7021 (Risk Level 4 - Cyber Security)

### 3. NIST 800-171 Controls Library (`nist_800_171_controls.csv`)
**Fields:**
- control_identifier
- domain
- level
- practice_statement
- objective
- discussion
- evidence_examples

**Control Count:** 110 controls (complete CMMC Level 2 requirement set)
**Domains Covered:** 14 families
1. Access Control (AC) - 22 controls
2. Awareness and Training (AT) - 3 controls
3. Audit and Accountability (AU) - 9 controls
4. Configuration Management (CM) - 9 controls
5. Identification and Authentication (IA) - 11 controls
6. Incident Response (IR) - 3 controls
7. Maintenance (MA) - 6 controls
8. Media Protection (MP) - 9 controls
9. Personnel Security (PS) - 2 controls
10. Physical Protection (PE) - 6 controls
11. Risk Assessment (RA) - 3 controls
12. Security Assessment (CA) - 4 controls
13. System and Communications Protection (SC) - 16 controls
14. System and Information Integrity (SI) - 7 controls

## Documents Not Successfully Retrieved (Access Restricted)

### CMMC Official Documentation
- **CMMC Model Overview v2.0:** 403 Forbidden error from DoD CIO website
- **CMMC Assessment Guide Level 2:** 403 Forbidden error from DoD CIO website
- **Workaround:** Created complete NIST 800-171 controls CSV which forms the basis of CMMC Level 2

**Note:** The CMMC Level 2 requirements are identical to NIST SP 800-171 Rev 2 (110 controls). The structured CSV we created contains all necessary information for implementation.

## File Locations Summary

```
/home/ubuntu/
├── Downloads/
│   ├── NIST_SP_800-171_Rev2.pdf (1.5 MB)
│   └── NIST_SP_800-53_Rev5.pdf (5.8 MB)
├── page_texts/
│   ├── www.acquisition.gov_far_part-52.md (2.2 MB)
│   └── www.acquisition.gov_dfars_part-252-solicitation-provisions-and-contract-clauses.md (1.5 MB)
├── far_clauses_sample.csv
├── dfars_clauses_sample.csv
└── nist_800_171_controls.csv
```

## Next Steps for Cursor Project

1. **Expand Clause Libraries:** Parse the full FAR and DFARS markdown files to extract all clauses (not just the 50-clause samples)

2. **Add Risk Classifications:** Enhance the clause CSVs with risk classifications from the governance manual's Appendix A

3. **Create Additional Data Files:**
   - Chart of Accounts (from user's accounting system)
   - Insurance Tiers Matrix
   - Indemnification Language Library
   - Form Templates (MAC-FRM-XXX series)

4. **Integration:** Import all CSV files into the PostgreSQL database during Cursor project initialization

## Data Quality Notes

- All clause numbers and titles are extracted directly from official government sources
- NIST 800-171 controls include practice statements, objectives, and evidence examples
- Risk levels in sample CSVs are placeholder values (2) except for identified high-risk cyber clauses (4)
- Full risk classification should be applied based on the governance manual's Clause Risk Library (Appendix A)

## Usage Instructions

To use these files in the Cursor project:

1. Place all CSV files in the `/cursor-project-data/compliance/` directory
2. Place PDF files in the `/cursor-project-data/reference-documents/` directory
3. The backend seed scripts will parse and import these files into the database
4. The frontend will reference these libraries for clause selection, risk assessment, and compliance tracking

---

**Data Collection Completed:** February 13, 2026
**Total Files Retrieved:** 7 (4 source documents + 3 structured CSVs)
**Ready for Cursor Project Integration:** Yes
