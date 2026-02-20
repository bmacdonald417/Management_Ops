/**
 * Phase 5: Governance sidebar navigation config.
 * Pre-Bid Dashboard and Doctrine Builder grouped in one section; no redundant standalone Doctrine tab.
 */
export interface SidebarNavItem {
  path: string;
  label: string;
  roles?: string[];
  /** When set, parent is active when location matches this path (e.g. dashboard + doctrine). */
  activePaths?: string[];
  children?: { path: string; label: string }[];
}

export const governanceSidebarNav: SidebarNavItem[] = [
  {
    path: '/governance-engine',
    label: 'Pre-Bid Dashboard',
    activePaths: ['/governance-engine', '/governance-engine/doctrine'],
    children: [
      { path: '/governance-engine', label: 'Overview' },
      { path: '/governance-engine/doctrine', label: 'Doctrine Builder' }
    ]
  },
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
  }
];
