import { query } from '../connection.js';

const CLAUSE_TYPES = ['FAR', 'DFARS', 'AGENCY', 'OTHER'] as const;
const CATEGORIES = [
  'TERMINATION', 'CHANGES', 'AUDIT_RECORDS', 'CYBER_CUI', 'INSURANCE', 'INDEMNIFICATION',
  'LABOR', 'SMALL_BUSINESS', 'PROPERTY', 'IP_DATA_RIGHTS', 'OCI_ETHICS', 'TRADE_COMPLIANCE',
  'FUNDING_PAYMENT', 'OTHER'
] as const;
const FLOW_DOWN = ['YES', 'NO', 'CONDITIONAL'] as const;

interface StarterClause {
  clause_number: string;
  title: string;
  type: (typeof CLAUSE_TYPES)[number];
  category: (typeof CATEGORIES)[number];
  financial: number;
  cyber: number;
  liability: number;
  regulatory: number;
  performance: number;
  suggested_risk_level: number;
  flow_down: (typeof FLOW_DOWN)[number];
  flow_down_notes?: string;
  notes?: string;
}

const STARTER_CLAUSES: StarterClause[] = [
  { clause_number: '252.204-7012', title: 'Safeguarding Covered Defense Information and Cyber Incident Reporting', type: 'DFARS', category: 'CYBER_CUI', financial: 2, cyber: 5, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES', flow_down_notes: 'Required for subcontractors handling CDI', notes: 'Critical for DoD contracts with CUI' },
  { clause_number: '252.204-7021', title: 'Notice of NIST SP 800-171 DoD Assessment Requirements', type: 'DFARS', category: 'CYBER_CUI', financial: 2, cyber: 5, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '252.204-7019', title: 'Notice of NIST SP 800-171 DoD Assessment Requirements', type: 'DFARS', category: 'CYBER_CUI', financial: 2, cyber: 5, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '252.204-7008', title: 'Compliance with Safeguarding Covered Defense Information Controls', type: 'DFARS', category: 'CYBER_CUI', financial: 2, cyber: 5, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '52.215-2', title: 'Audit and Records—Negotiation', type: 'FAR', category: 'AUDIT_RECORDS', financial: 4, cyber: 1, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL', flow_down_notes: 'Cost-reimbursable subcontracts' },
  { clause_number: '52.215-1', title: 'Instructions to Offerors—Competitive Acquisition', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 3, performance: 1, suggested_risk_level: 2, flow_down: 'NO' },
  { clause_number: '52.216-7', title: 'Allowable Cost and Payment', type: 'FAR', category: 'FUNDING_PAYMENT', financial: 4, cyber: 1, liability: 2, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.232-7', title: 'Payments Under Time-and-Materials and Labor-Hour Contracts', type: 'FAR', category: 'FUNDING_PAYMENT', financial: 4, cyber: 1, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.232-20', title: 'Limitation of Cost', type: 'FAR', category: 'FUNDING_PAYMENT', financial: 4, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.232-22', title: 'Limitation of Funds', type: 'FAR', category: 'FUNDING_PAYMENT', financial: 4, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.249-2', title: 'Termination for Convenience of the Government (Fixed-Price)', type: 'FAR', category: 'TERMINATION', financial: 4, cyber: 1, liability: 4, regulatory: 2, performance: 3, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '52.249-6', title: 'Termination (Cost-Reimbursement)', type: 'FAR', category: 'TERMINATION', financial: 4, cyber: 1, liability: 4, regulatory: 2, performance: 3, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '52.249-8', title: 'Default (Fixed-Price Supply and Service)', type: 'FAR', category: 'TERMINATION', financial: 4, cyber: 1, liability: 4, regulatory: 3, performance: 4, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '52.243-1', title: 'Changes—Fixed-Price', type: 'FAR', category: 'CHANGES', financial: 3, cyber: 1, liability: 3, regulatory: 2, performance: 3, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.243-2', title: 'Changes—Cost-Reimbursement', type: 'FAR', category: 'CHANGES', financial: 4, cyber: 1, liability: 3, regulatory: 2, performance: 3, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.219-14', title: 'Limitations on Subcontracting', type: 'FAR', category: 'SMALL_BUSINESS', financial: 2, cyber: 1, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.219-9', title: 'Small Business Subcontracting Plan', type: 'FAR', category: 'SMALL_BUSINESS', financial: 2, cyber: 1, liability: 2, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.222-41', title: 'Service Contract Labor Standards', type: 'FAR', category: 'LABOR', financial: 2, cyber: 1, liability: 2, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.222-50', title: 'Combating Trafficking in Persons', type: 'FAR', category: 'LABOR', financial: 2, cyber: 1, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.222-1', title: 'Notice to the Government of Labor Disputes', type: 'FAR', category: 'LABOR', financial: 2, cyber: 1, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.242-15', title: 'Stop-Work Order', type: 'FAR', category: 'CHANGES', financial: 3, cyber: 1, liability: 3, regulatory: 2, performance: 3, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.245-1', title: 'Government Property', type: 'FAR', category: 'PROPERTY', financial: 3, cyber: 1, liability: 4, regulatory: 3, performance: 3, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.245-9', title: 'Use and Charges', type: 'FAR', category: 'PROPERTY', financial: 3, cyber: 1, liability: 3, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'CONDITIONAL' },
  { clause_number: '52.227-14', title: 'Rights in Data—General', type: 'FAR', category: 'IP_DATA_RIGHTS', financial: 2, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.227-17', title: 'Rights in Data—Special Works', type: 'FAR', category: 'IP_DATA_RIGHTS', financial: 2, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '252.227-7013', title: 'Rights in Technical Data—Noncommercial Items', type: 'DFARS', category: 'IP_DATA_RIGHTS', financial: 2, cyber: 1, liability: 4, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '252.227-7014', title: 'Rights in Noncommercial Computer Software and Noncommercial Computer Software Documentation', type: 'DFARS', category: 'IP_DATA_RIGHTS', financial: 2, cyber: 1, liability: 4, regulatory: 4, performance: 2, suggested_risk_level: 4, flow_down: 'YES' },
  { clause_number: '52.203-13', title: 'Contractor Code of Business Ethics and Conduct', type: 'FAR', category: 'OCI_ETHICS', financial: 2, cyber: 1, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.203-14', title: 'Display of Hotline Poster(s)', type: 'FAR', category: 'OCI_ETHICS', financial: 1, cyber: 1, liability: 2, regulatory: 3, performance: 1, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.225-13', title: 'Restrictions on Certain Foreign Purchases', type: 'FAR', category: 'TRADE_COMPLIANCE', financial: 2, cyber: 1, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '252.225-7008', title: 'Restriction on Acquisition of Specialty Metals', type: 'DFARS', category: 'TRADE_COMPLIANCE', financial: 2, cyber: 1, liability: 2, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.228-5', title: 'Insurance—Work on a Government Installation', type: 'FAR', category: 'INSURANCE', financial: 2, cyber: 1, liability: 3, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'CONDITIONAL' },
  { clause_number: '52.228-7', title: 'Insurance—Liability to Third Persons', type: 'FAR', category: 'INSURANCE', financial: 3, cyber: 1, liability: 4, regulatory: 2, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.228-13', title: 'Alternative Payment Protections', type: 'FAR', category: 'INSURANCE', financial: 2, cyber: 1, liability: 2, regulatory: 2, performance: 1, suggested_risk_level: 2, flow_down: 'NO' },
  { clause_number: '52.228-3', title: 'Workers\' Compensation Insurance (Defense Base Act)', type: 'FAR', category: 'INSURANCE', financial: 2, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.228-4', title: 'Workers\' Compensation and War-Hazard Insurance Overseas', type: 'FAR', category: 'INSURANCE', financial: 2, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.250-1', title: 'Indemnification Under Public Law 85-804', type: 'FAR', category: 'INDEMNIFICATION', financial: 3, cyber: 1, liability: 4, regulatory: 3, performance: 2, suggested_risk_level: 4, flow_down: 'CONDITIONAL' },
  { clause_number: '52.236-1', title: 'Performance of Work by the Contractor', type: 'FAR', category: 'CHANGES', financial: 2, cyber: 1, liability: 2, regulatory: 2, performance: 3, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.246-2', title: 'Inspection of Supplies—Fixed-Price', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.246-3', title: 'Inspection of Supplies—Cost-Reimbursement', type: 'FAR', category: 'OTHER', financial: 3, cyber: 1, liability: 2, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.247-63', title: 'Preference for U.S.-Flag Air Carriers', type: 'FAR', category: 'TRADE_COMPLIANCE', financial: 1, cyber: 1, liability: 1, regulatory: 3, performance: 1, suggested_risk_level: 1, flow_down: 'YES' },
  { clause_number: '52.211-5', title: 'Material Requirements', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.211-12', title: 'Liquidated Damages—Supplies, Services, or Research and Development', type: 'FAR', category: 'OTHER', financial: 3, cyber: 1, liability: 4, regulatory: 2, performance: 3, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '52.211-15', title: 'Defense Priority and Allocation Requirements', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.212-4', title: 'Contract Terms and Conditions—Commercial Products and Commercial Services', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 3, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'NO' },
  { clause_number: '52.212-5', title: 'Contract Terms and Conditions Required To Implement Statutes or Executive Orders—Commercial Products and Commercial Services', type: 'FAR', category: 'OTHER', financial: 2, cyber: 2, liability: 3, regulatory: 4, performance: 2, suggested_risk_level: 3, flow_down: 'NO' },
  { clause_number: '52.204-21', title: 'Basic Safeguarding of Covered Contractor Information Systems', type: 'FAR', category: 'CYBER_CUI', financial: 2, cyber: 4, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.204-19', title: 'Incorporation by Reference of Representations and Certifications', type: 'FAR', category: 'OTHER', financial: 1, cyber: 1, liability: 1, regulatory: 2, performance: 1, suggested_risk_level: 1, flow_down: 'NO' },
  { clause_number: '52.215-8', title: 'Order of Precedence—Uniform Contract Format', type: 'FAR', category: 'OTHER', financial: 1, cyber: 1, liability: 1, regulatory: 1, performance: 1, suggested_risk_level: 1, flow_down: 'NO' },
  { clause_number: '52.233-1', title: 'Disputes', type: 'FAR', category: 'OTHER', financial: 3, cyber: 1, liability: 3, regulatory: 3, performance: 2, suggested_risk_level: 3, flow_down: 'YES' },
  { clause_number: '52.233-3', title: 'Protest After Award', type: 'FAR', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 3, performance: 1, suggested_risk_level: 2, flow_down: 'NO' },
  { clause_number: '52.249-14', title: 'Excusable Delays', type: 'FAR', category: 'TERMINATION', financial: 2, cyber: 1, liability: 2, regulatory: 2, performance: 2, suggested_risk_level: 2, flow_down: 'YES' },
  { clause_number: '52.242-13', title: 'Bankruptcy', type: 'FAR', category: 'TERMINATION', financial: 4, cyber: 1, liability: 3, regulatory: 2, performance: 2, suggested_risk_level: 3, flow_down: 'CONDITIONAL' },
  { clause_number: '252.232-7003', title: 'Electronic Submission of Payment Requests', type: 'DFARS', category: 'FUNDING_PAYMENT', financial: 2, cyber: 2, liability: 1, regulatory: 3, performance: 2, suggested_risk_level: 2, flow_down: 'CONDITIONAL' },
  { clause_number: '252.243-7001', title: 'Pricing of Contract Modifications', type: 'DFARS', category: 'CHANGES', financial: 3, cyber: 1, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 2, flow_down: 'CONDITIONAL' },
  { clause_number: '252.244-7000', title: 'Subcontracts for Commercial Products and Commercial Services', type: 'DFARS', category: 'OTHER', financial: 2, cyber: 1, liability: 2, regulatory: 3, performance: 2, suggested_risk_level: 2, flow_down: 'YES' }
];

export async function seedClauseLibraryStarter(): Promise<number> {
  let count = 0;
  for (const c of STARTER_CLAUSES) {
    const regType = c.type === 'DFARS' ? 'DFARS' : 'FAR';
    await query(
      `INSERT INTO clause_library_items (
        clause_number, title, type, regulation_type, category,
        default_financial, default_cyber, default_liability, default_regulatory, default_performance,
        suggested_risk_level, flow_down, flow_down_notes, notes, active, updated_at,
        override_risk_category, override_risk_score, override_flow_down_required
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), $15, $16, $17)
      ON CONFLICT (regulation_type, clause_number) DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        regulation_type = EXCLUDED.regulation_type,
        category = EXCLUDED.category,
        override_risk_category = EXCLUDED.override_risk_category,
        override_risk_score = EXCLUDED.override_risk_score,
        override_flow_down_required = EXCLUDED.override_flow_down_required,
        default_financial = EXCLUDED.default_financial,
        default_cyber = EXCLUDED.default_cyber,
        default_liability = EXCLUDED.default_liability,
        default_regulatory = EXCLUDED.default_regulatory,
        default_performance = EXCLUDED.default_performance,
        suggested_risk_level = EXCLUDED.suggested_risk_level,
        flow_down = EXCLUDED.flow_down,
        flow_down_notes = EXCLUDED.flow_down_notes,
        notes = EXCLUDED.notes,
        updated_at = NOW()`,
      [
        c.clause_number,
        c.title,
        c.type,
        regType,
        c.category,
        c.financial,
        c.cyber,
        c.liability,
        c.regulatory,
        c.performance,
        c.suggested_risk_level,
        c.flow_down,
        c.flow_down_notes ?? null,
        c.notes ?? null,
        c.category,
        c.suggested_risk_level,
        c.flow_down === 'YES'
      ]
    );
    count++;
  }
  return count;
}
