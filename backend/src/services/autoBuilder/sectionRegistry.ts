import { getImproveLinks, getPillarsForSection } from './maturityBridge.js';
import type { AutoBuilderContext } from './context.js';

export type MaturityLevel = 'PLANNED' | 'MANUAL' | 'ENFORCED' | 'AUTOMATED' | 'VERIFIED';

export interface SectionEval {
  level: MaturityLevel;
  score0to1: number;
  gaps: string[];
  evidenceRefs: string[];
}

export interface SectionEntry {
  id: string;
  title: string;
  order: number;
  part: string;
  baseMarkdown: string;
  maturityEvaluator: (ctx: AutoBuilderContext) => SectionEval;
}

const PART1 = 'PART I – ENTERPRISE GOVERNANCE ARCHITECTURE';
const PART2 = 'PART II – CONTRACT RISK GOVERNANCE';
const PART3 = 'PART III – FINANCIAL & DCAA-ALIGNED GOVERNANCE';
const PART4 = 'PART IV – INSURANCE & RISK TRANSFER';
const PART5 = 'PART V – CYBER & CUI GOVERNANCE';
const PART6 = 'PART VI – CLAIMS & CONTRACT ADMINISTRATION';
const PART7 = 'PART VII – STRUCTURAL & SDVOSB CONTROL PRESERVATION';
const PART8 = 'PART VIII – INTERNAL AUDIT & PERFORMANCE GOVERNANCE';

function evalByPillar(ctx: AutoBuilderContext, pillar: string): number {
  const m = ctx.maturity;
  const map: Record<string, number> = {
    Contract: m.pillarContract / 100,
    Financial: m.pillarFinancial / 100,
    Cyber: m.pillarCyber / 100,
    Insurance: m.pillarInsurance / 100,
    Structural: m.pillarStructural / 100,
    Audit: m.pillarAudit / 100,
    Documentation: m.pillarDocumentation / 100
  };
  return map[pillar] ?? 0;
}

function evalSection(ctx: AutoBuilderContext, pillars: string[], built: boolean): SectionEval {
  const scores = pillars.map((p) => evalByPillar(ctx, p));
  const score0to1 = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const gaps: string[] = [];
  if (score0to1 < 0.5) gaps.push('Below 50% maturity threshold');
  if (score0to1 < 0.75) gaps.push('Target 75%+ for automation');
  if (!built) gaps.push('Module not yet built - planned');
  let level: MaturityLevel = 'PLANNED';
  if (built) {
    if (score0to1 >= 0.9) level = 'VERIFIED';
    else if (score0to1 >= 0.75) level = 'AUTOMATED';
    else if (score0to1 >= 0.5) level = 'ENFORCED';
    else level = 'MANUAL';
  }
  return {
    level,
    score0to1,
    gaps,
    evidenceRefs: built ? ['Live metrics from governance engine'] : []
  };
}

const BUILT_PARTS = ['1', '2', '3', '4', '5', '6', '8'];
const BUILT_CYBER = false;
const BUILT_FINANCIAL = true;
const BUILT_CONTRACTS = true;

export const SECTION_REGISTRY: SectionEntry[] = [
  { id: '1.0', title: 'Governance Authority & Structural Control', order: 10, part: PART1, baseMarkdown: 'Enterprise governance authority is established through documented delegation and structural controls.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.0'), true) },
  { id: '1.1', title: 'Purpose & Scope', order: 11, part: PART1, baseMarkdown: 'This manual defines the governance framework for federal contract risk management.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.1'), true) },
  { id: '1.2', title: 'Authority & Delegation Structure', order: 12, part: PART1, baseMarkdown: 'Authority flows from executive leadership through designated governance roles.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.2'), true) },
  { id: '1.3', title: 'Governance Operating Model', order: 13, part: PART1, baseMarkdown: 'The operating model aligns governance activities with contract lifecycle stages.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.3'), true) },
  { id: '1.4', title: 'Document Control Hierarchy', order: 14, part: PART1, baseMarkdown: 'Documents are controlled through versioning and approval workflows.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.4'), true) },
  { id: '1.5', title: 'Versioning & Lock Enforcement', order: 15, part: PART1, baseMarkdown: 'Finalized records are locked; revisions create new versions.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.5'), true) },
  { id: '1.6', title: 'System-of-Record Doctrine', order: 16, part: PART1, baseMarkdown: 'The governance platform is the system of record for contract governance.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('1.6'), true) },
  { id: '2.0', title: 'Governance Maturity & Automation Framework', order: 20, part: PART1, baseMarkdown: 'Maturity is measured via the Governance Completeness Index (GCI).', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.0'), true) },
  { id: '2.1', title: 'Governance Completeness Index (GCI)', order: 21, part: PART1, baseMarkdown: 'GCI computes pillar scores from live data: Contract, Financial, Cyber, Insurance, Structural, Audit, Documentation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.1'), true) },
  { id: '2.2', title: 'Pillar Scoring Methodology', order: 22, part: PART1, baseMarkdown: 'Each pillar aggregates normalized metrics (0–1) scaled to 0–20 points.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.2'), true) },
  { id: '2.3', title: 'Automation Classification', order: 23, part: PART1, baseMarkdown: 'PLANNED, MANUAL, ENFORCED, AUTOMATED, VERIFIED.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.3'), true) },
  { id: '2.4', title: 'System Telemetry & Evidence', order: 24, part: PART1, baseMarkdown: 'Audit events and metrics provide evidence for governance compliance.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.4'), true) },
  { id: '2.5', title: 'Continuous Improvement Cycle', order: 25, part: PART1, baseMarkdown: 'Gap analysis and Auto-Builder drive continuous improvement.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('2.5'), true) },
  { id: '3.0', title: 'Clause Risk Governance Architecture', order: 30, part: PART2, baseMarkdown: 'Clause library and risk classification model form the foundation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.0'), true) },
  { id: '3.1', title: 'Clause Library Structure', order: 31, part: PART2, baseMarkdown: 'Clause library contains FAR/DFARS clauses with type, category, and scoring presets.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.1'), true) },
  { id: '3.2', title: 'Risk Classification Model', order: 32, part: PART2, baseMarkdown: 'Five dimensions: Financial, Cyber, Liability, Regulatory, Performance.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.2'), true) },
  { id: '3.3', title: 'Weighting & Thresholds', order: 33, part: PART2, baseMarkdown: 'Configurable weights and L1–L4 thresholds in risk model config.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.3'), true) },
  { id: '3.4', title: 'Escalation Triggers', order: 34, part: PART2, baseMarkdown: 'L4 clauses, 3+ L3, Cost-Reimbursable + risk, DFARS 7012, Indemnification L3+.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.4'), true) },
  { id: '3.5', title: 'Clause Version Control', order: 35, part: PART2, baseMarkdown: 'Clause library supports versioning and default presets.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.5'), true) },
  { id: '3.6', title: 'Clause Risk Log Doctrine', order: 36, part: PART2, baseMarkdown: 'Every solicitation requires clause review or attestation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('3.6'), true) },
  { id: '4.0', title: 'Pre-Bid Review & Escalation Enforcement', order: 40, part: PART2, baseMarkdown: 'Mandatory workflow: Intake → Clause Entry → Scoring → Risk Summary → Approvals → Finalize.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.0'), true) },
  { id: '4.1', title: 'Mandatory Workflow Architecture', order: 41, part: PART2, baseMarkdown: 'Stepper-based review with gated transitions.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.1'), true) },
  { id: '4.2', title: 'Approval Gating Model', order: 42, part: PART2, baseMarkdown: 'Executive, Quality, Financial, Cyber approvals based on escalation rules.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.2'), true) },
  { id: '4.3', title: 'Override Protocol', order: 43, part: PART2, baseMarkdown: 'Quality/SysAdmin can unlock; waivers require justification.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.3'), true) },
  { id: '4.4', title: 'Finalization Lock Logic', order: 44, part: PART2, baseMarkdown: 'Cannot finalize without metadata, clauses, scoring, resolved escalations.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.4'), true) },
  { id: '4.5', title: 'Executive Escalation Doctrine', order: 45, part: PART2, baseMarkdown: 'L4 requires Executive approval.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('4.5'), true) },
  { id: '5.0', title: 'Flow-Down Governance', order: 50, part: PART2, baseMarkdown: 'Flow-down identification and subcontract risk transmission.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('5.0'), true) },
  { id: '5.1', title: 'Flow-Down Identification Model', order: 51, part: PART2, baseMarkdown: 'Clause library flow_down: YES, NO, CONDITIONAL.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('5.1'), true) },
  { id: '5.2', title: 'Conditional Flow-Down Mapping', order: 52, part: PART2, baseMarkdown: 'Conditional clauses require case-by-case determination.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('5.2'), true) },
  { id: '5.3', title: 'Subcontract Risk Transmission', order: 53, part: PART2, baseMarkdown: 'Subcontracts inherit flow-down requirements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('5.3'), BUILT_CONTRACTS) },
  { id: '5.4', title: 'Flow-Down Audit Requirements', order: 54, part: PART2, baseMarkdown: 'Audit trail captures flow-down decisions.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('5.4'), true) },
  { id: '6.0', title: 'Cost Accounting Architecture', order: 60, part: PART3, baseMarkdown: 'Direct vs indirect segregation and job cost traceability.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.0'), BUILT_FINANCIAL) },
  { id: '6.1', title: 'Direct vs Indirect Segregation', order: 61, part: PART3, baseMarkdown: 'Cost elements are classified as direct or indirect.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.1'), BUILT_FINANCIAL) },
  { id: '6.2', title: 'Cost Pool Definitions', order: 62, part: PART3, baseMarkdown: 'Fringe, Overhead, G&A pools defined.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.2'), BUILT_FINANCIAL) },
  { id: '6.3', title: 'Job Cost Traceability', order: 63, part: PART3, baseMarkdown: 'Job cost logs link to contracts.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.3'), BUILT_FINANCIAL) },
  { id: '6.4', title: 'Funding Threshold Monitoring', order: 64, part: PART3, baseMarkdown: 'Contract funding tracked against thresholds.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.4'), BUILT_CONTRACTS) },
  { id: '6.5', title: 'Change Order Financial Controls', order: 65, part: PART3, baseMarkdown: 'Change orders require financial review.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('6.5'), BUILT_CONTRACTS) },
  { id: '7.0', title: 'Indirect Rate Methodology', order: 70, part: PART3, baseMarkdown: 'Fringe, Overhead, G&A methodology.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('7.0'), BUILT_FINANCIAL) },
  { id: '7.1', title: 'Fringe, Overhead, G&A', order: 71, part: PART3, baseMarkdown: 'Rate types and allocation bases.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('7.1'), BUILT_FINANCIAL) },
  { id: '7.2', title: 'Allocation Base Definitions', order: 72, part: PART3, baseMarkdown: 'Allocation bases for indirect pools.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('7.2'), BUILT_FINANCIAL) },
  { id: '7.3', title: 'True-Up Doctrine', order: 73, part: PART3, baseMarkdown: 'Provisional to final rate true-up process.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('7.3'), BUILT_FINANCIAL) },
  { id: '7.4', title: 'Provisional vs Final Rates', order: 74, part: PART3, baseMarkdown: 'Provisional rates used until final rates established.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('7.4'), BUILT_FINANCIAL) },
  { id: '8.0', title: 'Allowability & FAR Compliance Controls', order: 80, part: PART3, baseMarkdown: 'FAR Part 31 allowability controls.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('8.0'), BUILT_FINANCIAL) },
  { id: '8.1', title: 'FAR Part 31 Overview', order: 81, part: PART3, baseMarkdown: 'Allowable cost principles.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('8.1'), BUILT_FINANCIAL) },
  { id: '8.2', title: 'Allowable vs Unallowable Controls', order: 82, part: PART3, baseMarkdown: 'Costs classified per FAR 31.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('8.2'), BUILT_FINANCIAL) },
  { id: '8.3', title: 'Audit Trail Requirements', order: 83, part: PART3, baseMarkdown: 'Immutable audit for financial transactions.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('8.3'), true) },
  { id: '8.4', title: 'DCAA Readiness Protocol', order: 84, part: PART3, baseMarkdown: 'DCAA audit readiness checklist.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('8.4'), BUILT_FINANCIAL) },
  { id: '9.0', title: 'Insurance Minimum Standards', order: 90, part: PART4, baseMarkdown: 'Baseline insurance coverage requirements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('9.0'), BUILT_CONTRACTS) },
  { id: '9.1', title: 'Baseline Coverage Requirements', order: 91, part: PART4, baseMarkdown: 'Minimum coverage limits.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('9.1'), BUILT_CONTRACTS) },
  { id: '9.2', title: 'Contract-Specific Scaling', order: 92, part: PART4, baseMarkdown: 'Coverage scales with contract value.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('9.2'), BUILT_CONTRACTS) },
  { id: '9.3', title: 'Certificate Tracking', order: 93, part: PART4, baseMarkdown: 'COI tracking and renewal.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('9.3'), BUILT_CONTRACTS) },
  { id: '9.4', title: 'Additional Insured Requirements', order: 94, part: PART4, baseMarkdown: 'Additional insured endorsements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('9.4'), BUILT_CONTRACTS) },
  { id: '10.0', title: 'Indemnification & Liability Exposure', order: 100, part: PART4, baseMarkdown: 'Indemnification exposure matrix.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('10.0'), true) },
  { id: '10.1', title: 'Indemnification Exposure Matrix', order: 101, part: PART4, baseMarkdown: 'Indemnification clauses by risk tier.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('10.1'), true) },
  { id: '10.2', title: 'Risk Tier Mapping', order: 102, part: PART4, baseMarkdown: 'L1–L4 mapped to indemnification exposure.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('10.2'), true) },
  { id: '10.3', title: 'Escalation Doctrine', order: 103, part: PART4, baseMarkdown: 'Indemnification L3+ triggers escalation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('10.3'), true) },
  { id: '10.4', title: 'Risk Transfer Model', order: 104, part: PART4, baseMarkdown: 'Risk transfer through insurance and indemnification.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('10.4'), BUILT_CONTRACTS) },
  { id: '11.0', title: 'CUI Boundary Architecture', order: 110, part: PART5, baseMarkdown: 'Logical and physical CUI segmentation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('11.0'), BUILT_CYBER) },
  { id: '11.1', title: 'Logical & Physical Segmentation', order: 111, part: PART5, baseMarkdown: 'CUI boundaries defined.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('11.1'), BUILT_CYBER) },
  { id: '11.2', title: 'Role-Based Access Enforcement', order: 112, part: PART5, baseMarkdown: 'RBAC for CUI access.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('11.2'), BUILT_CYBER) },
  { id: '11.3', title: 'MFA Enforcement', order: 113, part: PART5, baseMarkdown: 'MFA required for CUI systems.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('11.3'), BUILT_CYBER) },
  { id: '11.4', title: 'Data Retention Controls', order: 114, part: PART5, baseMarkdown: 'Retention and disposal controls.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('11.4'), BUILT_CYBER) },
  { id: '12.0', title: 'Incident Response Framework', order: 120, part: PART5, baseMarkdown: 'Detection, escalation, 72-hour reporting.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('12.0'), BUILT_CYBER) },
  { id: '12.1', title: 'Detection & Escalation', order: 121, part: PART5, baseMarkdown: 'Incident detection and escalation workflow.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('12.1'), BUILT_CYBER) },
  { id: '12.2', title: '72-Hour Reporting Doctrine', order: 122, part: PART5, baseMarkdown: 'DFARS 252.204-7012 reporting requirements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('12.2'), BUILT_CYBER) },
  { id: '12.3', title: 'Documentation Requirements', order: 123, part: PART5, baseMarkdown: 'Incident documentation requirements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('12.3'), BUILT_CYBER) },
  { id: '12.4', title: 'Root Cause Analysis', order: 124, part: PART5, baseMarkdown: 'RCA for significant incidents.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('12.4'), BUILT_CYBER) },
  { id: '13.0', title: 'CMMC Alignment Model', order: 130, part: PART5, baseMarkdown: 'CMMC control mapping and ownership.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('13.0'), BUILT_CYBER) },
  { id: '13.1', title: 'Control Mapping Strategy', order: 131, part: PART5, baseMarkdown: 'NIST 800-171 to CMMC mapping.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('13.1'), BUILT_CYBER) },
  { id: '13.2', title: 'Control Ownership', order: 132, part: PART5, baseMarkdown: 'Control owner assignment.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('13.2'), BUILT_CYBER) },
  { id: '13.3', title: 'Continuous Monitoring', order: 133, part: PART5, baseMarkdown: 'Ongoing control assessment.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('13.3'), BUILT_CYBER) },
  { id: '13.4', title: 'POA&M Governance', order: 134, part: PART5, baseMarkdown: 'Plan of Action & Milestones tracking.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('13.4'), BUILT_CYBER) },
  { id: '14.0', title: 'REA & Claims Governance', order: 140, part: PART6, baseMarkdown: 'REA calculation and claims documentation.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('14.0'), BUILT_CONTRACTS) },
  { id: '14.1', title: 'REA Calculation Doctrine', order: 141, part: PART6, baseMarkdown: 'REA calculation methodology.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('14.1'), BUILT_CONTRACTS) },
  { id: '14.2', title: 'Claims Documentation Indexing', order: 142, part: PART6, baseMarkdown: 'Claims documentation structure.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('14.2'), BUILT_CONTRACTS) },
  { id: '14.3', title: 'Termination Settlement Framework', order: 143, part: PART6, baseMarkdown: 'Termination for convenience settlement.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('14.3'), BUILT_CONTRACTS) },
  { id: '14.4', title: 'Change Order Controls', order: 144, part: PART6, baseMarkdown: 'Change order approval workflow.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('14.4'), BUILT_CONTRACTS) },
  { id: '15.0', title: 'Ownership & Control Governance', order: 150, part: PART7, baseMarkdown: 'SDVOSB ownership and control requirements.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('15.0'), BUILT_CONTRACTS) },
  { id: '15.1', title: 'SDVOSB Regulatory Summary', order: 151, part: PART7, baseMarkdown: 'SDVOSB eligibility rules.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('15.1'), BUILT_CONTRACTS) },
  { id: '15.2', title: 'Affiliation Risk Monitoring', order: 152, part: PART7, baseMarkdown: 'Affiliation risk indicators.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('15.2'), BUILT_CONTRACTS) },
  { id: '15.3', title: 'Control Preservation Matrix', order: 153, part: PART7, baseMarkdown: 'Control preservation checklist.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('15.3'), BUILT_CONTRACTS) },
  { id: '15.4', title: 'Negative Control Avoidance', order: 154, part: PART7, baseMarkdown: 'Negative control doctrine.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('15.4'), BUILT_CONTRACTS) },
  { id: '16.0', title: 'Annual Governance Audit Framework', order: 160, part: PART8, baseMarkdown: 'Annual audit scope and KPI oversight.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('16.0'), true) },
  { id: '16.1', title: 'Audit Scope & Schedule', order: 161, part: PART8, baseMarkdown: 'Audit scope and schedule.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('16.1'), true) },
  { id: '16.2', title: 'KPI Oversight', order: 162, part: PART8, baseMarkdown: 'Governance KPI dashboard.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('16.2'), true) },
  { id: '16.3', title: 'Corrective Action Doctrine', order: 163, part: PART8, baseMarkdown: 'Corrective action tracking.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('16.3'), true) },
  { id: '16.4', title: 'Executive Certification', order: 164, part: PART8, baseMarkdown: 'Executive certification process.', maturityEvaluator: (ctx) => evalSection(ctx, getPillarsForSection('16.4'), true) }
];

export const APPENDIX_LIST = [
  'Appendix A – Clause Risk Library (Expanded)',
  'Appendix B – Flow-Down Clause Master Table',
  'Appendix C – Insurance Minimum Standards',
  'Appendix D – Indemnification Exposure Matrix',
  'Appendix E – CUI Boundary Requirements',
  'Appendix F – Incident Response Framework',
  'Appendix G – CMMC Control Mapping Matrix',
  'Appendix H – Cost Pool Definitions',
  'Appendix I – Indirect Rate Methodology',
  'Appendix J – Allowability Summary',
  'Appendix K – Insurance Minimum Standards',
  'Appendix L – Risk Transfer Matrix',
  'Appendix M – Sample Additional Insured Endorsement Language',
  'Appendix N – Standard Notice Language Templates',
  'Appendix O – REA Calculation Example',
  'Appendix P – Termination Settlement Framework',
  'Appendix Q – Claims Documentation Indexing Guide',
  'Appendix R – SDVOSB Regulatory Summary',
  'Appendix S – Affiliation Risk Indicators',
  'Appendix T – Control Preservation Matrix',
  'Appendix U – Annual Audit Master Checklist',
  'Appendix V – Sample Audit Report Format',
  'Appendix W – Governance KPI Dashboard Model'
];

export function getImproveLinksForSection(sectionId: string) {
  return getImproveLinks(sectionId);
}
