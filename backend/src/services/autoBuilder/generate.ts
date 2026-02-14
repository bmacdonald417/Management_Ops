import type { AutoBuilderContext } from './context.js';
import { SECTION_REGISTRY, APPENDIX_LIST } from './sectionRegistry.js';
import { getImproveLinks } from './maturityBridge.js';

export function generateManualMarkdown(ctx: AutoBuilderContext): string {
  const lines: string[] = [];
  lines.push('# Federal Contract Governance & Risk Management Manual');
  lines.push(`\n*Auto-generated ${new Date().toISOString().split('T')[0]}*\n`);

  let lastPart = '';
  const sorted = [...SECTION_REGISTRY].sort((a, b) => a.order - b.order);
  for (const s of sorted) {
    if (s.part !== lastPart) {
      lastPart = s.part;
      lines.push(`\n## ${lastPart}\n`);
    }
    const eval_ = s.maturityEvaluator(ctx);
    lines.push(`### ${s.id} ${s.title}`);
    lines.push(`\n**Maturity:** ${eval_.level} | **Score:** ${Math.round(eval_.score0to1 * 100)}%\n`);
    lines.push(s.baseMarkdown);
    if (eval_.gaps.length > 0) {
      lines.push('\n**Gaps:**');
      for (const g of eval_.gaps) lines.push(`- ${g}`);
    }
    const links = getImproveLinks(s.id);
    if (links.length > 0) {
      lines.push('\n**Improve:**');
      for (const l of links) lines.push(`- [${l.label}](${l.href}) – ${l.reason}`);
    }
    lines.push('\n---\n');
  }

  lines.push('\n## Appendices\n');
  for (const a of APPENDIX_LIST) {
    lines.push(`- ${a}`);
  }
  return lines.join('\n');
}

export function generateEvidenceMarkdown(ctx: AutoBuilderContext): string {
  const m = ctx.maturity;
  const lines: string[] = [];
  lines.push('# Evidence & Action Packet');
  lines.push(`\n*Auto-generated ${new Date().toISOString().split('T')[0]}*\n`);

  lines.push('## Governance Completeness Index (GCI)\n');
  lines.push(`**Overall Score:** ${m.overallScore}%\n`);
  lines.push('### Pillar Breakdown\n');
  const pillars = [
    { name: 'Contract', val: m.pillarContract },
    { name: 'Financial', val: m.pillarFinancial },
    { name: 'Cyber', val: m.pillarCyber },
    { name: 'Insurance', val: m.pillarInsurance },
    { name: 'Structural', val: m.pillarStructural },
    { name: 'Audit', val: m.pillarAudit },
    { name: 'Documentation', val: m.pillarDocumentation }
  ];
  for (const p of pillars) {
    lines.push(`- **${p.name}:** ${p.val}%`);
  }

  const sectionScores = SECTION_REGISTRY.map((s) => ({
    id: s.id,
    title: s.title,
    ...s.maturityEvaluator(ctx)
  })).sort((a, b) => a.score0to1 - b.score0to1);
  const dci = sectionScores.length > 0
    ? sectionScores.reduce((s, x) => s + x.score0to1, 0) / sectionScores.length * 100
    : 0;
  lines.push(`\n## Document Completeness Index (DCI)\n`);
  lines.push(`**DCI:** ${Math.round(dci)}%\n`);

  lines.push('## Top 10 Gaps by Severity\n');
  const topGaps = m.gapTable
    .filter((g) => g.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 10);
  if (topGaps.length === 0) {
    lines.push('No gaps meeting severity threshold.\n');
  } else {
    for (const g of topGaps) {
      lines.push(`- **${g.metricName}:** ${g.currentPct}% (target ${g.targetPct}%, delta ${g.delta})`);
    }
  }

  lines.push('\n## Section Maturity Map\n');
  lines.push('| Section | Title | Level | Score | Top Gaps |');
  lines.push('|---------|-------|-------|-------|----------|');
  for (const s of [...sectionScores].reverse().slice(0, 20)) {
    const gaps = s.gaps.slice(0, 2).join('; ') || '—';
    lines.push(`| ${s.id} | ${s.title} | ${s.level} | ${Math.round(s.score0to1 * 100)}% | ${gaps} |`);
  }

  lines.push('\n## Automation Disconnects\n');
  for (const d of m.disconnectIndicators) {
    lines.push(`- ⚠ ${d}`);
  }
  if (m.disconnectIndicators.length === 0) {
    lines.push('No disconnects identified.\n');
  }

  lines.push('\n## Fix Next Queue\n');
  const weakest = sectionScores.slice(0, 5);
  for (const s of weakest) {
    const links = getImproveLinks(s.id);
    const href = links[0]?.href ?? '/governance-engine';
    const label = links[0]?.label ?? 'Improve';
    lines.push(`- [${label}](${href}) – ${s.id} ${s.title} (${Math.round(s.score0to1 * 100)}%)`);
  }

  return lines.join('\n');
}
