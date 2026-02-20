/**
 * Phase 2.2: Contract Lifecycle Governance Framework — 11 phases.
 * Maps section identifiers to doctrine requirements for contextual assistance in the Governance Builder.
 */
export interface LifecyclePhase {
  sectionNumber: string;
  title: string;
  requirement: string;
  order: number;
}

export const CONTRACT_LIFECYCLE_PHASES: LifecyclePhase[] = [
  { sectionNumber: '1.1', title: 'Governance Philosophy', requirement: 'Establish and document the organization\'s governance philosophy. Risk must be accepted deliberately, documented formally, and escalated appropriately. Governance principles must align with the Enterprise Risk Doctrine.', order: 1 },
  { sectionNumber: '1.2', title: 'Enterprise Risk Doctrine', requirement: 'Define the enterprise risk appetite and tolerance. All contract-related decisions must reference this doctrine. Executive ownership of risk acceptance is required for material exposures.', order: 2 },
  { sectionNumber: '2.1', title: 'Market Surveillance', requirement: 'Maintain systematic monitoring of opportunities and market conditions. Capture and track relevant solicitations and competitive intelligence.', order: 3 },
  { sectionNumber: '2.2', title: 'Opportunity Identification', requirement: 'Document criteria for opportunity qualification and disqualification. Ensure alignment with strategic objectives and risk tolerance before pursuit.', order: 4 },
  { sectionNumber: '2.3', title: 'Pre-Bid Risk Screening', requirement: 'Perform structured pre-bid risk assessment. All clauses must be extracted, assessed, and escalated per the governance maturity model. Risk must be accepted deliberately, documented formally, and escalated appropriately before bid submission.', order: 5 },
  { sectionNumber: '3.1', title: 'Proposal Development', requirement: 'Proposals must incorporate governance outputs (risk assessments, compliance attestations, flow-down obligations). Ensure traceability from solicitation clauses to proposal response.', order: 6 },
  { sectionNumber: '3.2', title: 'Proposal Review', requirement: 'Multi-tier approval required per risk level. L3/L4 clauses require designated approvers. All approvals must be recorded and auditable.', order: 7 },
  { sectionNumber: '4.1', title: 'Contract Award', requirement: 'Post-award review must validate governance compliance. Contract documentation must be archived and linked to pre-bid risk artifacts.', order: 8 },
  { sectionNumber: '4.2', title: 'Contract Performance', requirement: 'Monitor performance against governance commitments. Track flow-down obligations, compliance milestones, and audit findings.', order: 9 },
  { sectionNumber: '5.1', title: 'Closeout', requirement: 'Closeout must include governance artifact review and lessons learned. Ensure final compliance attestations are recorded.', order: 10 },
  { sectionNumber: '5.2', title: 'Lessons Learned', requirement: 'Capture and institutionalize lessons learned. Update clause library, risk models, and governance procedures based on outcomes.', order: 11 },
];

/**
 * Find phase by section number (supports fuzzy match: "2.2", "2.2.1" → 2.2)
 */
export function getPhaseForSectionNumber(sectionNumber: string): LifecyclePhase | undefined {
  const normalized = sectionNumber.trim();
  const exact = CONTRACT_LIFECYCLE_PHASES.find((p) => p.sectionNumber === normalized);
  if (exact) return exact;
  const prefix = normalized.split('.')[0];
  const minor = normalized.split('.')[1];
  return CONTRACT_LIFECYCLE_PHASES.find(
    (p) => p.sectionNumber.startsWith(`${prefix}.${minor}`) || normalized.startsWith(p.sectionNumber)
  );
}
