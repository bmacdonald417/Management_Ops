# Cursor Prompt: Build the MacTech Enterprise Federal Governance & Risk Management Platform

## 1. The Objective

Your task is to act as an expert full-stack software architect and developer. You will build a comprehensive, enterprise-grade, audit-ready **Federal Contract Governance & Risk Management Platform** for a company named MacTech Solutions LLC. 

This platform must be a high-end, secure, and scalable web application that operationalizes the company's rigorous governance policies. The primary goal is to create a system that demonstrates viability and extreme diligence to federal contracting officials (e.g., from the DoD) and is ready for DCAA and CMMC audits.

## 2. Core Source Documents & Requirements

Your development will be strictly guided by the two provided foundational documents. All features, data models, and workflows must be directly traceable to the requirements within them.

1.  **`GovernancePhilosophy&EnterpriseRiskDoctrine.txt`**: This document establishes the core governance philosophy, risk management framework, clause architecture, financial integrity rules, and compliance doctrines.
2.  **`MacTech_Enterprise_Governance_Execution_Roadmap.pdf`**: This document provides a 12-month, 4-phase implementation plan for deploying the governance system.

I have analyzed these documents and synthesized the critical system requirements, architecture, and API specifications. You will find them embedded below. **You must adhere to this design.**

---

## 3. High-Level System Architecture & Technology Stack

You will build the platform using a modern, cloud-native, microservices-based architecture. All services will communicate via a well-defined RESTful API.

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React (with Vite), TypeScript, Tailwind CSS | A modern, component-based framework for building a responsive and interactive user interface. TypeScript adds static typing for improved code quality and maintainability. |
| **Backend** | Node.js (with Express.js), TypeScript | A performant and scalable runtime for building microservices. TypeScript ensures type safety and better developer experience. |
| **Database** | PostgreSQL | A powerful, open-source object-relational database system with a strong reputation for reliability, feature robustness, and performance. Excellent for structured data and complex queries. |
| **Infrastructure** | Amazon Web Services (AWS) | A comprehensive and secure cloud platform offering a wide range of services for compute, storage, database, and networking, ideal for building a FISMA-compliant system. |
| **Authentication** | Auth0 / AWS Cognito | Managed identity and access management service to handle user authentication, multi-factor authentication (MFA), and role-based access control (RBAC) securely. |
| **File Storage** | AWS S3 | Secure, scalable, and highly available object storage for all documents, evidence, and attachments, with versioning and access control. |

---

## 4. Backend Microservices Architecture

The backend will be composed of several independent microservices. This modularity is key to supporting the phased rollout and ensuring scalability. You will build the following services:

*   **Contracts Service:** Manages the entire contract lifecycle, from opportunity to closeout.
*   **Risk Service:** Handles risk classification, assessment, and mitigation tracking.
*   **Compliance Service:** Manages clause libraries, flow-down requirements, and regulatory compliance.
*   **Cyber Service:** Tracks CUI, CMMC compliance, and incident response.
*   **Financials Service:** Manages cost pools, indirect rates, and job costing.
*   **Users Service:** Manages user profiles, roles, and permissions.
*   **Documents Service:** Handles document storage, versioning, and retrieval.
*   **Notifications Service:** Manages all system-generated notifications (email, in-app).

---

## 5. Detailed API Specification

You must implement the following RESTful API endpoints for each microservice. All endpoints must be secured via JWT-based authentication and enforce the specified Role-Based Access Control (RBAC).

### 5.1 Contracts Service (`/api/contracts`)

**Data Model: Contract**

```json
{
  "id": "string (uuid)",
  "title": "string",
  "contract_number": "string",
  "agency": "string",
  "naics_code": "string",
  "contract_type": "string",
  "period_of_performance_start": "date",
  "period_of_performance_end": "date",
  "total_contract_value": "number",
  "funded_amount": "number",
  "status": "string (e.g., Opportunity, Pre-Bid, Awarded, Active, Closed)",
  "risk_profile_id": "string (uuid)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Endpoints:**

*   `POST /api/contracts`: Create a new contract opportunity.
*   `GET /api/contracts`: Retrieve a list of all contracts with filtering.
*   `GET /api/contracts/{id}`: Retrieve a single contract.
*   `PUT /api/contracts/{id}`: Update a contract.
*   `DELETE /api/contracts/{id}`: Soft delete a contract.
*   `POST /api/contracts/{id}/phases`: Advance a contract to the next lifecycle phase.

### 5.2 Risk Service (`/api/risk`)

**Data Model: RiskProfile**

```json
{
  "id": "string (uuid)",
  "contract_id": "string (uuid)",
  "strategic_risk_level": "integer (1-4)",
  "financial_risk_level": "integer (1-4)",
  "regulatory_risk_level": "integer (1-4)",
  "cyber_risk_level": "integer (1-4)",
  "operational_risk_level": "integer (1-4)",
  "reputational_risk_level": "integer (1-4)",
  "overall_risk_level": "integer (1-4)",
  "status": "string (e.g., Draft, Submitted, Approved)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Endpoints:**

*   `POST /api/risk/profiles`: Create a new risk profile.
*   `GET /api/risk/profiles/{id}`: Retrieve a risk profile.
*   `PUT /api/risk/profiles/{id}`: Update a risk profile.
*   `POST /api/risk/escalations`: Log a new risk escalation.

### 5.3 Compliance Service (`/api/compliance`)

**Data Models:** `Clause`, `ContractClauseLink`

**Endpoints:**

*   `GET /api/compliance/library`: Retrieve the master clause library.
*   `POST /api/compliance/library`: Add a new clause to the library.
*   `GET /api/compliance/contracts/{contractId}/clauses`: Get clauses for a specific contract.
*   `POST /api/compliance/contracts/{contractId}/clauses`: Link a clause to a contract.
*   `PUT /api/compliance/contracts/{contractId}/clauses/{linkId}`: Update a contract clause link.

### 5.4 Cyber Service (`/api/cyber`)

**Data Models:** `CMMCControl`, `IncidentReport`

**Endpoints:**

*   `GET /api/cyber/cmmc/controls`: Retrieve all CMMC controls.
*   `POST /api/cyber/cmmc/controls`: Add a new CMMC control.
*   `GET /api/cyber/incidents`: Retrieve all incident reports.
*   `POST /api/cyber/incidents`: Create a new incident report.
*   `PUT /api/cyber/incidents/{id}`: Update an incident report.

### 5.5 Financials Service (`/api/financials`)

**Data Models:** `JobCostLog`, `IndirectRate`

**Endpoints:**

*   `GET /api/financials/rates`: Retrieve indirect rates.
*   `POST /api/financials/rates`: Create a new indirect rate.
*   `GET /api/financials/contracts/{contractId}/costs`: Retrieve job cost logs for a contract.
*   `POST /api/financials/contracts/{contractId}/costs`: Log new costs for a contract.

### 5.6 Users, Documents, and Notifications Services

Implement the `Users` (`/api/users`), `Documents` (`/api/documents`), and `Notifications` (`/api/notifications`) services as detailed in the architecture document. This includes user management, secure file handling with pre-signed S3 URLs, and a real-time notification system.

---

## 6. Frontend Architecture & UI/UX

You will build a clean, professional, and highly intuitive Single Page Application (SPA) using React, TypeScript, and Tailwind CSS. The user experience should inspire confidence and project an image of extreme competence to a contracting official.

**Key UI Modules to Build:**

*   **Executive Dashboard:** This is the landing page. It must provide a high-level, at-a-glance view of the company's governance health. Include KPI widgets for: 
    *   Active Contracts vs. Opportunities
    *   Portfolio-wide Risk Exposure (a chart showing the distribution of contracts by risk level)
    *   Open Compliance Tasks
    *   Pending Approvals
    *   Active Cyber Incidents
*   **Contracts Module:** A master-detail view for all contracts. The list view must be searchable and filterable. The detail view for a single contract must be a central hub that consolidates all related data from other services: its risk profile, all applicable clauses, its full financial ledger, all associated documents, and its complete history.
*   **Risk Module:** A section to manage the company-wide risk posture. It should allow users to view the Risk Classification Matrix and track all risk escalations.
*   **Compliance Module:** This module will house the master FAR/DFARS Clause Library. Users must be able to browse, search, and manage clauses. It will also be used to manage the flow-down of clauses to subcontractors.
*   **Cyber Module:** A dedicated dashboard for the CISO. It must track CMMC compliance status against the control library, manage POA&Ms, and provide the workflow for the 72-hour incident reporting process.
*   **Financials Module:** A module for the CFO to manage the DCAA-aligned cost accounting system. It must provide tools to manage indirect rates, review job cost reports, and flag unallowable costs.
*   **Admin Module:** A secure area for the Sole Managing Member to manage user roles, system settings, and view the global, immutable audit log.

---

## 7. Security, Compliance & Audit-Readiness (CRITICAL)

This is the most critical aspect of the project. The platform must be architected for security from the ground up.

*   **Role-Based Access Control (RBAC):** Strictly enforce the governance hierarchy. A Program Manager should not be able to approve a cost-reimbursable contract. An Admin should not be able to sign off on a Level 4 risk. Implement the following roles:
    *   **Level 1 - Sole Managing Member:** God-mode. Full approval authority.
    *   **Level 2 - Authorized Manager:** Delegated authority with scope limits.
    *   **Level 3 - Quality/Compliance Oversight:** Read/write on risk and compliance modules.
    *   **Level 4 - Program Execution Authority:** Read/write on specific, assigned contracts.
    *   **Level 5 - Administrative Support:** Data entry and read-only access.
*   **Data Encryption:** All data, without exception, must be encrypted at rest (AWS KMS) and in transit (TLS 1.2+).
*   **Immutable Audit Trails:** Every single create, update, or delete action taken in the system must be logged to an immutable audit table. The log must record the user, the action, the timestamp, and the data that was changed. This is non-negotiable for DCAA audits.
*   **Secure Document Handling:** All document uploads and downloads must use short-lived, pre-signed URLs from S3. There should be no direct, public links to any stored documents.

---
## 8. Phased Implementation Plan

You must structure your development to follow the 12-month, 4-phase execution roadmap. Use feature flags or modular deployment to roll out functionality incrementally.

*   **Phase I (0-90 Days) - Governance Foundation:**
    *   **Focus:** Stand up the core system. Implement the `Contracts`, `Compliance` (Clause Log), and `Financials` (Chart of Accounts) services.
    *   **Key Features:** Create the Clause Risk Log, the pre-bid review workflow, and the DCAA-aligned chart of accounts.

*   **Phase II (90-180 Days) - Structural Enforcement:**
    *   **Focus:** Add automated financial and cyber controls.
    *   **Key Features:** Build the automated indirect rate calculator, the indemnification escalation workflow, and the 72-hour cyber incident reporting framework.

*   **Phase III (180-270 Days) - Operational Integration:**
    *   **Focus:** Make governance measurable.
    *   **Key Features:** Deploy the Governance KPI Dashboard, the subcontractor cyber affirmation process, and the internal CMMC readiness review tools.

*   **Phase IV (270-365 Days) - Enterprise Optimization:**
    *   **Focus:** Achieve prime-grade maturity.
    *   **Key Features:** Implement automated risk escalation tracking, prepare the system for cost-reimbursable contracts, and build the generator for the Annual Executive Governance Report.

## 9. Final Deliverable

Your final output should be a fully functional, deployed web application with a complete set of features as described. The code should be clean, well-documented, and organized into separate repositories for each microservice and the frontend. You should also provide the Terraform scripts for the infrastructure. Prepare a brief final report summarizing the architecture and how it meets every requirement from the source documents.

This is a significant build. Proceed logically, starting with the backend services and API definitions before moving to the frontend. Good luck.
