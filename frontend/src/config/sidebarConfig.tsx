/**
 * Phase 5: Governance sidebar navigation config.
 * Top-level and sub-menu items; role-based visibility can be added via roles array.
 */
export interface SidebarNavItem {
  path: string;
  label: string;
  roles?: string[];
  children?: { path: string; label: string }[];
}

export const governanceSidebarNav: SidebarNavItem[] = [
  { path: '/governance-engine', label: 'Pre-Bid Dashboard' },
  { path: '/governance-engine/solicitations', label: 'Solicitations' },
  { path: '/governance-engine/clause-library', label: 'Clause Library' },
  { path: '/governance-engine/auto-builder', label: 'Auto-Builder' },
  { path: '/governance-engine/copilot', label: 'Copilot' },
  { path: '/governance-engine/maturity', label: 'Maturity' },
  { path: '/governance-engine/reports', label: 'Reports' },
  { path: '/governance-engine/signature-requests', label: 'Signature Requests' },
  {
    path: '/governance-engine/proposals',
    label: 'Proposals',
    children: [
      { path: '/governance-engine/proposals/new', label: 'Create New' },
      { path: '/governance-engine/proposals', label: 'Templates / All' }
    ]
  },
  {
    path: '/governance-engine/doctrine',
    label: 'Governance Doctrine',
    children: [
      { path: '/governance-engine/doctrine#completeness', label: 'Completeness Index' },
      { path: '/governance-engine/doctrine#sections', label: 'Manage Sections' }
    ]
  }
];
