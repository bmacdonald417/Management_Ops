
# System Architecture & API Specification
## Federal Contract Governance & Risk Management Platform

### 1. Introduction

This document outlines the comprehensive system architecture and API specifications for the MacTech Federal Contract Governance & Risk Management Platform. The design is based on the detailed requirements extracted from the *MacTech Solutions LLC Governance Philosophy & Enterprise Risk Doctrine Manual*. The platform is engineered to be a secure, scalable, and auditable system that provides contracting officials with a clear view of MacTech's viability and robust governance posture.

### 2. High-Level System Architecture

The platform will be built using a modern, cloud-native, microservices-based architecture. This approach provides strong separation of concerns, enhances scalability, and allows for independent development and deployment of different system components. All services will communicate via a well-defined RESTful API, secured with industry-standard authentication and authorization protocols.

#### 2.1 Architectural Diagram

A high-level diagram will be generated to visualize the interaction between the frontend, backend microservices, database, and external integrations.

*(Note: A diagram will be generated in a later step to be included here.)*

#### 2.2 Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React (with Vite), TypeScript, Tailwind CSS | A modern, component-based framework for building a responsive and interactive user interface. TypeScript adds static typing for improved code quality and maintainability. |
| **Backend** | Node.js (with Express.js), TypeScript | A performant and scalable runtime for building microservices. TypeScript ensures type safety and better developer experience. |
| **Database** | PostgreSQL | A powerful, open-source object-relational database system with a strong reputation for reliability, feature robustness, and performance. Excellent for structured data and complex queries. |
| **Infrastructure** | Amazon Web Services (AWS) | A comprehensive and secure cloud platform offering a wide range of services for compute, storage, database, and networking, ideal for building a FISMA-compliant system. |
| **Authentication** | Auth0 / AWS Cognito | Managed identity and access management service to handle user authentication, multi-factor authentication (MFA), and role-based access control (RBAC) securely. |
| **File Storage** | AWS S3 | Secure, scalable, and highly available object storage for all documents, evidence, and attachments, with versioning and access control. |

### 3. Backend Microservices

The backend will be composed of several independent microservices, each responsible for a specific domain of the governance platform. This modularity allows for focused development, independent scaling, and improved fault isolation.

*   **Contracts Service:** Manages the entire contract lifecycle, from opportunity to closeout.
*   **Risk Service:** Handles risk classification, assessment, and mitigation tracking.
*   **Compliance Service:** Manages clause libraries, flow-down requirements, and regulatory compliance.
*   **Cyber Service:** Tracks CUI, CMMC compliance, and incident response.
*   **Financials Service:** Manages cost pools, indirect rates, and job costing.
*   **Users Service:** Manages user profiles, roles, and permissions.
*   **Documents Service:** Handles document storage, versioning, and retrieval.
*   **Notifications Service:** Manages all system-generated notifications (email, in-app).

---
### 4. API Specification

This section details the RESTful API endpoints for each microservice. All endpoints will be secured via JWT-based authentication and will enforce role-based access control (RBAC).

#### 4.1 Contracts Service (`/api/contracts`)

Manages all aspects of the contract lifecycle.

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

*   **`POST /api/contracts`**: Create a new contract opportunity.
    *   **Request Body**: `Contract` object (without `id`, `created_at`, `updated_at`).
    *   **Response**: `201 Created` with the newly created `Contract` object.

*   **`GET /api/contracts`**: Retrieve a list of all contracts.
    *   **Query Parameters**: `status`, `agency`, `contract_type` (for filtering).
    *   **Response**: `200 OK` with an array of `Contract` objects.

*   **`GET /api/contracts/{id}`**: Retrieve a single contract by its ID.
    *   **Response**: `200 OK` with the `Contract` object.

*   **`PUT /api/contracts/{id}`**: Update a contract.
    *   **Request Body**: Partial `Contract` object with fields to update.
    *   **Response**: `200 OK` with the updated `Contract` object.

*   **`DELETE /api/contracts/{id}`**: Delete a contract (soft delete).
    *   **Response**: `204 No Content`.

*   **`POST /api/contracts/{id}/phases`**: Advance a contract to the next lifecycle phase.
    *   **Request Body**: `{ "phase": "string (e.g., Pre-Bid, Awarded)" }`
    *   **Response**: `200 OK` with the updated `Contract` object.

---
#### 4.2 Risk Service (`/api/risk`)

Manages risk profiles, classifications, and escalations.

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

*   **`POST /api/risk/profiles`**: Create a new risk profile for a contract.
    *   **Request Body**: `RiskProfile` object (without `id`, `created_at`, `updated_at`).
    *   **Response**: `201 Created` with the newly created `RiskProfile` object.

*   **`GET /api/risk/profiles/{id}`**: Retrieve a risk profile by its ID.
    *   **Response**: `200 OK` with the `RiskProfile` object.

*   **`PUT /api/risk/profiles/{id}`**: Update a risk profile.
    *   **Request Body**: Partial `RiskProfile` object with fields to update.
    *   **Response**: `200 OK` with the updated `RiskProfile` object.

*   **`POST /api/risk/escalations`**: Log a new risk escalation.
    *   **Request Body**: `{ "risk_profile_id": "string (uuid)", "description": "string", "escalation_level": "integer (1-4)" }`
    *   **Response**: `201 Created` with the new escalation log entry.

---
#### 4.3 Compliance Service (`/api/compliance`)

Manages contract clauses, flow-down requirements, and the clause library.

**Data Model: Clause**

```json
{
  "id": "string (uuid)",
  "clause_number": "string (e.g., FAR 52.249-2)",
  "title": "string",
  "risk_category": "string",
  "risk_level": "integer (1-4)",
  "description": "string",
  "mitigation_strategy": "string",
  "flow_down_required": "boolean"
}
```

**Data Model: ContractClauseLink**

```json
{
  "id": "string (uuid)",
  "contract_id": "string (uuid)",
  "clause_id": "string (uuid)",
  "applicability": "string (e.g., Included, Not Applicable)",
  "notes": "string"
}
```

**Endpoints:**

*   **`GET /api/compliance/library`**: Retrieve the master clause library.
    *   **Query Parameters**: `risk_level`, `risk_category`.
    *   **Response**: `200 OK` with an array of `Clause` objects.

*   **`POST /api/compliance/library`**: Add a new clause to the master library.
    *   **Request Body**: `Clause` object (without `id`).
    *   **Response**: `201 Created` with the newly created `Clause` object.

*   **`GET /api/compliance/contracts/{contractId}/clauses`**: Get all clauses associated with a specific contract.
    *   **Response**: `200 OK` with an array of `ContractClauseLink` objects joined with `Clause` details.

*   **`POST /api/compliance/contracts/{contractId}/clauses`**: Link a clause from the library to a contract.
    *   **Request Body**: `{ "clause_id": "string (uuid)", "applicability": "string", "notes": "string" }`
    *   **Response**: `201 Created` with the new `ContractClauseLink` object.

*   **`PUT /api/compliance/contracts/{contractId}/clauses/{linkId}`**: Update the applicability or notes for a contract clause.
    *   **Request Body**: `{ "applicability": "string", "notes": "string" }`
    *   **Response**: `200 OK` with the updated `ContractClauseLink` object.

---
#### 4.4 Cyber Service (`/api/cyber`)

Manages CUI, CMMC compliance, and incident reporting.

**Data Model: CMMCControl**

```json
{
  "id": "string (uuid)",
  "control_identifier": "string (e.g., AC.L2-3.1.1)",
  "domain": "string (e.g., Access Control)",
  "description": "string",
  "policy_reference": "string",
  "control_owner": "string",
  "evidence_location": "string (url)",
  "status": "string (e.g., Compliant, Non-Compliant, POA&M)"
}
```

**Data Model: IncidentReport**

```json
{
  "id": "string (uuid)",
  "contract_id": "string (uuid)",
  "incident_level": "integer (1-4)",
  "description": "string",
  "status": "string (e.g., Investigating, Reported, Remediated)",
  "reported_at": "datetime",
  "discovered_at": "datetime"
}
```

**Endpoints:**

*   **`GET /api/cyber/cmmc/controls`**: Retrieve all CMMC controls.
    *   **Query Parameters**: `domain`, `status`.
    *   **Response**: `200 OK` with an array of `CMMCControl` objects.

*   **`POST /api/cyber/cmmc/controls`**: Add a new CMMC control to the library.
    *   **Request Body**: `CMMCControl` object (without `id`).
    *   **Response**: `201 Created` with the newly created `CMMCControl` object.

*   **`GET /api/cyber/incidents`**: Retrieve all incident reports.
    *   **Query Parameters**: `status`, `contract_id`.
    *   **Response**: `200 OK` with an array of `IncidentReport` objects.

*   **`POST /api/cyber/incidents`**: Create a new incident report.
    *   **Request Body**: `IncidentReport` object (without `id`).
    *   **Response**: `201 Created` with the newly created `IncidentReport` object.

*   **`PUT /api/cyber/incidents/{id}`**: Update an incident report.
    *   **Request Body**: Partial `IncidentReport` object.
    *   **Response**: `200 OK` with the updated `IncidentReport` object.

---
#### 4.5 Financials Service (`/api/financials`)

Manages cost pools, indirect rates, and job cost accounting.

**Data Model: JobCostLog**

```json
{
  "id": "string (uuid)",
  "contract_id": "string (uuid)",
  "direct_labor_cost": "number",
  "direct_material_cost": "number",
  "subcontractor_cost": "number",
  "other_direct_cost": "number",
  "fringe_burden": "number",
  "overhead_burden": "number",
  "ga_burden": "number",
  "total_cost": "number",
  "log_date": "date"
}
```

**Data Model: IndirectRate**

```json
{
  "id": "string (uuid)",
  "rate_type": "string (e.g., Fringe, Overhead, G&A)",
  "rate_value": "number",
  "effective_date": "date",
  "quarter": "string (e.g., Q1 2026)"
}
```

**Endpoints:**

*   **`GET /api/financials/rates`**: Retrieve current and historical indirect rates.
    *   **Query Parameters**: `rate_type`, `quarter`.
    *   **Response**: `200 OK` with an array of `IndirectRate` objects.

*   **`POST /api/financials/rates`**: Create a new indirect rate for a specific quarter.
    *   **Request Body**: `IndirectRate` object (without `id`).
    *   **Response**: `201 Created` with the newly created `IndirectRate` object.

*   **`GET /api/financials/contracts/{contractId}/costs`**: Retrieve job cost logs for a specific contract.
    *   **Query Parameters**: `start_date`, `end_date`.
    *   **Response**: `200 OK` with an array of `JobCostLog` objects.

*   **`POST /api/financials/contracts/{contractId}/costs`**: Log new costs for a contract.
    *   **Request Body**: `JobCostLog` object (without `id`).
    *   **Response**: `201 Created` with the newly created `JobCostLog` object.

---
#### 4.6 Users Service (`/api/users`)

Manages user profiles, roles, and permissions, integrating with the chosen authentication provider.

**Data Model: User**

```json
{
  "id": "string (from Auth Provider)",
  "email": "string",
  "name": "string",
  "role": "string (e.g., Sole Managing Member, Authorized Manager, Compliance, Program, Admin)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Endpoints:**

*   **`GET /api/users`**: Retrieve a list of all users.
    *   **Response**: `200 OK` with an array of `User` objects.

*   **`GET /api/users/{id}`**: Retrieve a single user by their ID.
    *   **Response**: `200 OK` with the `User` object.

*   **`PUT /api/users/{id}`**: Update a user's role or details.
    *   **Request Body**: `{ "role": "string", "name": "string" }`
    *   **Response**: `200 OK` with the updated `User` object.

#### 4.7 Documents Service (`/api/documents`)

Hanles secure document upload, storage, versioning, and retrieval, integrating with AWS S3.

**Data Model: Document**

```json
{
  "id": "string (uuid)",
  "file_name": "string",
  "file_type": "string",
  "s3_key": "string",
  "version": "integer",
  "entity_id": "string (e.g., contract_id, incident_id)",
  "entity_type": "string (e.g., Contract, Incident)",
  "created_at": "datetime"
}
```

**Endpoints:**

*   **`POST /api/documents/upload`**: Get a pre-signed URL for uploading a file to S3.
    *   **Request Body**: `{ "file_name": "string", "file_type": "string", "entity_id": "string", "entity_type": "string" }`
    *   **Response**: `200 OK` with `{ "upload_url": "string", "document_id": "string" }`.

*   **`GET /api/documents/{id}/download`**: Get a pre-signed URL for downloading a file.
    *   **Response**: `200 OK` with `{ "download_url": "string" }`.

*   **`GET /api/documents/entity/{entity_type}/{entity_id}`**: Retrieve all documents associated with a specific entity.
    *   **Response**: `200 OK` with an array of `Document` objects.

#### 4.8 Notifications Service (`/api/notifications`)

Manages real-time, in-app, and email notifications for critical system events.

**Data Model: Notification**

```json
{
  "id": "string (uuid)",
  "user_id": "string",
  "message": "string",
  "type": "string (e.g., Alert, Information, Task)",
  "is_read": "boolean",
  "link": "string (optional URL to relevant page)",
  "created_at": "datetime"
}
```

**Endpoints:**

*   **`GET /api/notifications`**: Retrieve notifications for the authenticated user.
    *   **Query Parameters**: `is_read`.
    *   **Response**: `200 OK` with an array of `Notification` objects.

*   **`PUT /api/notifications/{id}/read`**: Mark a notification as read.
    *   **Response**: `204 No Content`.

---
### 5. Database Schema

The PostgreSQL database will be designed to support the microservices architecture. Each service will own its schema to ensure loose coupling, but they will all reside within the same database for ease of management in this initial design. Foreign key relationships will maintain data integrity across services.

**Key Tables:**

*   **`contracts`**: Stores core contract information.
*   **`contract_phases`**: Tracks the lifecycle phase history for each contract.
*   **`risk_profiles`**: Stores the detailed risk assessment for each contract.
*   **`risk_escalations`**: Logs all high-risk escalations for audit purposes.
*   **`clauses`**: The master library of all FAR/DFARS clauses.
*   **`contract_clauses`**: A join table linking contracts to clauses, with applicability notes.
*   **`cmmc_controls`**: The master library of CMMC controls.
*   **`contract_controls`**: A join table linking contracts to required CMMC controls.
*   **`incident_reports`**: Tracks all cyber security incidents.
*   **`job_cost_logs`**: Records all direct and indirect costs against a contract.
*   **`indirect_rates`**: Stores the calculated indirect rates (Fringe, Overhead, G&A) for each period.
*   **`users`**: Stores user profile information and roles.
*   **`documents`**: Manages metadata for all uploaded files.
*   **`notifications`**: Stores user-specific notifications.

*(A detailed SQL schema definition can be generated from the API data models as part of the implementation.)*

### 6. Frontend Architecture

The frontend will be a Single Page Application (SPA) built with React. It will be organized into a modular, component-based structure that mirrors the backend microservices.

**Key UI Components/Modules:**

*   **Dashboard:** A high-level overview of the governance posture, including KPIs, active risks, and pending tasks. This will be the main landing page.
*   **Contracts Module:** A comprehensive section for managing the entire contract lifecycle. It will include a filterable list of all contracts and a detailed view for each contract that consolidates all related information (risk, clauses, financials, documents).
*   **Risk Module:** A dedicated area for managing risk profiles, viewing the risk classification matrix, and tracking escalations.
*   **Compliance Module:** Allows for browsing the clause library, managing contract-specific clause logs, and tracking flow-down requirements.
*   **Cyber Module:** A dashboard for CMMC compliance, tracking controls, managing POA&Ms, and logging incident reports.
*   **Financials Module:** Provides tools for viewing job cost reports, managing indirect rates, and reviewing cost allowability.
*   **Admin Module:** A restricted area for managing users, roles, system settings, and viewing audit logs.

---
### 7. Security & Compliance Architecture

Security is a foundational requirement of the platform. The architecture will incorporate security at every layer, from infrastructure to application code, to ensure it is audit-ready and meets federal contracting standards.

**Key Security Measures:**

*   **Authentication & Authorization:** All API endpoints will be protected. Authentication will be handled by a dedicated identity provider (e.g., Auth0, AWS Cognito) using JWTs. Authorization will be enforced at the API gateway and within each microservice using a granular Role-Based Access Control (RBAC) model based on the defined user levels (Sole Managing Member, Admin, etc.).
*   **Data Encryption:** All data will be encrypted both in transit and at rest. TLS 1.2+ will be enforced for all API communication. Data at rest in the PostgreSQL database and in S3 will be encrypted using AWS Key Management Service (KMS).
*   **Audit Trails:** Every action taken within the system will be logged in an immutable audit trail. This includes all API calls, data modifications, and user access events. This is critical for DCAA and CMMC audit readiness.
*   **Infrastructure Security:** The entire platform will be deployed within a secure AWS Virtual Private Cloud (VPC) with strict network access control lists (ACLs) and security groups. The infrastructure will be configured to align with FISMA and CMMC Level 2+ requirements.
*   **Document Security:** All documents will be stored in a private S3 bucket. Access will be granted only through pre-signed URLs with short-lived expirations, ensuring that direct, unauthenticated access to sensitive files is impossible.

### 8. Deployment & Phased Rollout Strategy

The architecture is designed to support the 12-month phased execution roadmap.

*   **Infrastructure as Code (IaC):** The entire AWS infrastructure will be defined using Terraform. This allows for repeatable, automated, and version-controlled environment setup.
*   **CI/CD Pipeline:** A continuous integration and continuous deployment (CI/CD) pipeline will be established using GitHub Actions. Every code change will automatically trigger builds, tests, and deployments to a staging environment before manual promotion to production.
*   **Phased Feature Deployment:** The microservices architecture allows for the incremental deployment of features as outlined in the roadmap. For example:
    *   **Phase I (0-90 Days):** The initial deployment will focus on the core **Contracts**, **Compliance (Clause Log)**, and **Financials (Chart of Accounts)** services.
    *   **Phase II (90-180 Days):** The **Financials (Indirect Rate Calculator)** and **Cyber (Incident Reporting)** services will be deployed.
    *   **Phase III (180-270 Days):** The frontend **Dashboard** with KPIs will be rolled out, along with the **Cyber (CMMC Review)** module.
    *   **Phase IV (270-365 Days):** Advanced features like the **Annual Governance Report Generator** and automated risk escalation tracking will be implemented.

### 9. Executive Reporting

The platform will culminate in the ability to generate the **Annual Executive Governance Report** as specified in the roadmap. This will be a comprehensive, data-driven report that synthesizes information from all microservices to provide a holistic view of the company's governance posture, risk profile, and compliance status. The report will be configurable and exportable in PDF format for delivery to stakeholders.
