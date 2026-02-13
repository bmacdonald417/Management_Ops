# Required Reference Documents & Data Files for Cursor Project

## Overview

To build the MacTech Federal Governance Platform with complete, accurate compliance data, you need to provide the Cursor project with structured reference documents. These will be parsed and loaded into the backend database to populate the master libraries (Clause Library, CMMC Controls, Risk Matrix, etc.).

This document specifies exactly what you need to provide and in what format.

---

## 1. Governance & Policy Documents (Already Provided)

These foundational documents define your business rules and workflows:

### ✓ Already Provided
- **`GovernancePhilosophy&EnterpriseRiskDoctrine.txt`** - Your complete governance manual
- **`MacTech_Enterprise_Governance_Execution_Roadmap.pdf`** - Your 12-month implementation plan

### What the System Will Extract
- Risk classification levels and thresholds
- Approval authority matrix
- Lifecycle phase definitions
- Form templates (MAC-FRM-XXX references)
- Escalation protocols

---

## 2. FAR/DFARS Clause Library (REQUIRED)

This is the most critical data set. You need to provide a structured master list of all FAR and DFARS clauses that will populate your Clause Risk Log.

### Recommended Format: CSV or JSON

**Required Fields:**
```csv
clause_number,title,full_text_url,risk_category,risk_level,description,mitigation_strategy,flow_down_required,applicability_notes
```

### Example Entry:
```csv
"FAR 52.249-2","Termination for Convenience of the Government (Fixed-Price)","https://www.acquisition.gov/far/52.249-2","Financial Exposure",3,"Allows government to terminate contract for convenience with limited contractor recovery.","Maintain detailed cost records; negotiate favorable settlement provisions.","Yes","Applies to all fixed-price contracts"
```

### Where to Source This Data

**Option 1: Manual Compilation from Appendix A**
Your governance manual already contains a detailed Clause Risk Library in Appendix A. You can structure this into a CSV/JSON file.

**Option 2: Use Official FAR/DFARS Sources**
- **FAR (Federal Acquisition Regulation):** https://www.acquisition.gov/far/
- **DFARS (Defense FAR Supplement):** https://www.acquisition.gov/dfars/

**Option 3: Commercial Clause Libraries**
Consider purchasing or licensing a pre-structured clause database from:
- GovCon consulting firms
- Legal compliance software providers
- Government contracting training organizations

### Minimum Clauses to Include

Based on your governance manual, prioritize these high-risk clauses:

**Termination & Changes:**
- FAR 52.249-2 (Termination for Convenience)
- FAR 52.249-6 (Termination - Cost-Reimbursement)
- FAR 52.243-1 (Changes - Fixed-Price)

**Financial & Audit:**
- FAR 52.215-2 (Audit and Records)
- FAR 52.232-20 (Limitation of Cost)
- FAR 52.232-22 (Limitation of Funds)

**Cyber & Data:**
- DFARS 252.204-7012 (Safeguarding CUI)
- DFARS 252.204-7021 (CMMC)
- FAR 52.204-21 (Basic Safeguarding)

**Small Business:**
- FAR 52.219-14 (Limitations on Subcontracting)
- FAR 52.219-27 (Notice of SDVOSB Set-Aside)

**Labor:**
- FAR 52.222-41 (Service Contract Labor Standards)
- FAR 52.222-50 (Combating Trafficking in Persons)

---

## 3. CMMC Control Library (REQUIRED)

You need the complete CMMC (Cybersecurity Maturity Model Certification) control set to populate your cyber governance module.

### Recommended Format: CSV or JSON

**Required Fields:**
```csv
control_identifier,domain,level,practice_statement,objective,discussion,evidence_examples
```

### Example Entry:
```csv
"AC.L2-3.1.1","Access Control","Level 2","Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).","Prevent unauthorized access to organizational systems.","Organizations should implement access control policies and enforce them through technical and administrative controls.","Access control lists, MFA logs, user provisioning records"
```

### Where to Source This Data

**Official Source:**
- **CMMC Model (Version 2.0):** https://dodcio.defense.gov/CMMC/Model/
- Download the official CMMC Assessment Guide which contains all controls

**Alternative Sources:**
- NIST SP 800-171 Rev 2 (CMMC Level 2 is based on this)
- NIST SP 800-172 (for CMMC Level 3)

### CMMC Domains to Include

Your system must cover all 17 CMMC domains:
1. Access Control (AC)
2. Asset Management (AM)
3. Audit & Accountability (AU)
4. Awareness & Training (AT)
5. Configuration Management (CM)
6. Identification & Authentication (IA)
7. Incident Response (IR)
8. Maintenance (MA)
9. Media Protection (MP)
10. Personnel Security (PS)
11. Physical Protection (PE)
12. Recovery (RE)
13. Risk Management (RM)
14. Security Assessment (CA)
15. Situational Awareness (SA)
16. System & Communications Protection (SC)
17. System & Information Integrity (SI)

---

## 4. NIST Framework References (RECOMMENDED)

While not required for MVP, these enhance your cyber governance credibility:

### NIST SP 800-171 Rev 2
- **Purpose:** Protecting Controlled Unclassified Information (CUI)
- **Format:** PDF (official publication)
- **What to Extract:** The 110 security requirements organized into 14 families
- **Source:** https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final

### NIST SP 800-53 Rev 5
- **Purpose:** Security and Privacy Controls for Information Systems
- **Format:** PDF or XML
- **What to Extract:** Control catalog for mapping to CMMC
- **Source:** https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final

### NIST Cybersecurity Framework (CSF)
- **Purpose:** Framework for improving critical infrastructure cybersecurity
- **Format:** PDF
- **What to Extract:** The five functions (Identify, Protect, Detect, Respond, Recover)
- **Source:** https://www.nist.gov/cyberframework

---

## 5. ISO/IEC Standards (OPTIONAL - For Enterprise Maturity)

If you want to demonstrate alignment with international standards:

### ISO/IEC 27001:2022 (Information Security Management)
- **Purpose:** Information security management system requirements
- **What to Extract:** Annex A controls (93 controls across 4 themes)
- **Note:** This is a paid standard - purchase from ISO.org

### ISO 9001:2015 (Quality Management)
- **Purpose:** Quality management system requirements
- **What to Extract:** Process approach and quality principles
- **Note:** This is a paid standard

### ISO 31000:2018 (Risk Management)
- **Purpose:** Risk management guidelines
- **What to Extract:** Risk management framework and process
- **Note:** This is a paid standard

---

## 6. Insurance & Indemnification Matrix (REQUIRED)

Create a structured matrix of insurance requirements and indemnification language.

### Recommended Format: CSV

**Required Fields:**
```csv
insurance_type,tier_level,coverage_amount,deductible,required_for,notes
```

### Example Entries:
```csv
"General Liability","Tier 1","$1,000,000 per occurrence","$5,000","All contracts","Baseline coverage"
"General Liability","Tier 2","$2,000,000 per occurrence","$10,000","Prime contracts >$5M","Enhanced coverage for major pursuits"
"Cyber Liability","Tier 1","$1,000,000","$25,000","All contracts with CUI","DFARS 7012 compliance"
"Professional Liability","Tier 1","$1,000,000","$10,000","All professional services","Errors & omissions coverage"
```

### Indemnification Language Library

**Format:** JSON or CSV

```json
{
  "indemnification_type": "Standard Government",
  "risk_level": 1,
  "language": "Contractor shall indemnify the Government against...",
  "insurance_alignment": "General Liability - Tier 1",
  "approval_required": false
}
```

---

## 7. Cost Accounting Structure (REQUIRED)

Provide your DCAA-aligned chart of accounts structure.

### Recommended Format: CSV

**Required Fields:**
```csv
account_number,account_name,account_type,cost_category,allowable_under_far_31,notes
```

### Example Entries:
```csv
"5000","Direct Labor","Direct Cost","Direct Labor","Yes","Labor directly chargeable to contracts"
"5100","Direct Materials","Direct Cost","Direct Materials","Yes","Materials purchased for specific contracts"
"6000","Fringe Benefits","Indirect Cost","Fringe Pool","Yes","Employee benefits burden"
"6100","Payroll Taxes","Indirect Cost","Fringe Pool","Yes","FICA, Medicare, etc."
"7000","Indirect Labor","Indirect Cost","Overhead Pool","Yes","Labor not directly chargeable"
"7100","Rent","Indirect Cost","Overhead Pool","Yes","Office space rental"
"8000","Executive Compensation","Indirect Cost","G&A Pool","Conditional","Subject to compensation caps"
"9000","Entertainment","Unallowable","Unallowable","No","FAR 31.205-14 - Entertainment costs"
"9100","Alcoholic Beverages","Unallowable","Unallowable","No","FAR 31.205-51 - Alcoholic beverages"
```

---

## 8. Form Templates (RECOMMENDED)

Your governance manual references 22+ forms (MAC-FRM-XXX). Provide templates for:

### Priority Forms for Phase I:
- **MAC-FRM-010** - Risk Classification Matrix
- **MAC-FRM-012** - Bid/No-Bid Worksheet
- **MAC-FRM-013** - Clause Risk Log
- **MAC-FRM-021** - Flow-Down Matrix

### Format Options:
1. **PDF Templates** - For document generation
2. **JSON Schema** - For dynamic form generation in the UI
3. **HTML Templates** - For web-based forms

### Example JSON Schema for MAC-FRM-012 (Bid/No-Bid Worksheet):
```json
{
  "form_id": "MAC-FRM-012",
  "title": "Bid/No-Bid Worksheet",
  "version": "1.0",
  "fields": [
    {
      "field_name": "opportunity_name",
      "field_type": "text",
      "required": true,
      "label": "Opportunity Name"
    },
    {
      "field_name": "agency",
      "field_type": "text",
      "required": true,
      "label": "Contracting Agency"
    },
    {
      "field_name": "strategic_alignment",
      "field_type": "select",
      "options": ["High", "Medium", "Low"],
      "required": true,
      "label": "Strategic Alignment"
    }
  ]
}
```

---

## 9. Subcontractor Template Library (REQUIRED)

Provide your enterprise subcontract templates with flow-down clauses.

### Required Templates:
1. **Master Subcontract Agreement** (Word/PDF)
2. **Flow-Down Clause Matrix** (CSV/JSON)
3. **Cyber Affirmation Template** (PDF/Word)
4. **Insurance Requirements Template** (PDF/Word)

---

## 10. Data Organization Structure

### Recommended Project Directory Structure:

```
/cursor-project-data/
├── governance/
│   ├── GovernancePhilosophy&EnterpriseRiskDoctrine.txt
│   └── MacTech_Enterprise_Governance_Execution_Roadmap.pdf
├── compliance/
│   ├── far_clauses.csv
│   ├── dfars_clauses.csv
│   └── clause_risk_library.json
├── cyber/
│   ├── cmmc_controls_level2.csv
│   ├── cmmc_controls_level3.csv
│   ├── nist_800_171.pdf
│   └── nist_800_53.pdf
├── financial/
│   ├── chart_of_accounts.csv
│   ├── allowable_costs.csv
│   └── unallowable_costs.csv
├── insurance/
│   ├── insurance_tiers.csv
│   └── indemnification_matrix.json
├── forms/
│   ├── MAC-FRM-010_risk_matrix.json
│   ├── MAC-FRM-012_bid_no_bid.json
│   └── MAC-FRM-013_clause_log.json
└── templates/
    ├── subcontract_template.docx
    └── flow_down_matrix.csv
```

---

## 11. Implementation Priority

### Phase I (Immediate - 0-90 Days):
1. **FAR/DFARS Clause Library** (CSV) - CRITICAL
2. **Chart of Accounts** (CSV) - CRITICAL
3. **Risk Classification Matrix** (JSON) - CRITICAL
4. **Insurance Tiers** (CSV) - HIGH PRIORITY

### Phase II (90-180 Days):
5. **CMMC Controls Library** (CSV) - HIGH PRIORITY
6. **Indemnification Matrix** (JSON) - HIGH PRIORITY
7. **Form Templates** (JSON) - MEDIUM PRIORITY

### Phase III (180-270 Days):
8. **NIST 800-171 Mapping** (CSV) - MEDIUM PRIORITY
9. **Subcontract Templates** (DOCX) - MEDIUM PRIORITY

### Phase IV (270-365 Days):
10. **ISO Standards Mapping** (CSV) - LOW PRIORITY (Optional)

---

## 12. Quick Start: Minimum Viable Dataset

If you need to start development immediately, provide these three files:

1. **`far_dfars_clauses.csv`** - At least 20-30 high-risk clauses from Appendix A of your manual
2. **`chart_of_accounts.csv`** - Your complete DCAA-aligned account structure
3. **`cmmc_controls.csv`** - CMMC Level 2 controls (110 requirements from NIST 800-171)

The system can launch with these three datasets, and you can add the others incrementally.

---

## 13. Data Validation Checklist

Before providing data files to Cursor, validate:

- [ ] All CSV files have headers matching the specified field names
- [ ] No special characters that break CSV parsing (use proper escaping)
- [ ] All required fields are populated (no empty critical fields)
- [ ] Risk levels use consistent scale (1-4)
- [ ] Clause numbers match official FAR/DFARS numbering
- [ ] File encoding is UTF-8
- [ ] Large text fields (descriptions) are properly quoted in CSV

---

## Need Help Sourcing These Documents?

**For FAR/DFARS Clauses:**
- Work with a GovCon attorney or consultant to compile your clause library
- Consider licensing a commercial clause database
- Extract from your existing proposal templates

**For CMMC Controls:**
- Download the official CMMC Assessment Guide from DoD
- Use NIST SP 800-171 Rev 2 as the source for Level 2 controls

**For Financial Data:**
- Work with your accountant to export your chart of accounts
- Ensure alignment with DCAA requirements before importing

**For Forms:**
- Convert your existing Word/Excel forms to JSON schemas
- The Cursor project can help generate web-based forms from schemas

---

This document provides everything you need to prepare your reference data for the Cursor project. Start with the Minimum Viable Dataset and expand from there.
