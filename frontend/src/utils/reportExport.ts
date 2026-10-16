import type { AppAnalysis, CombinationFinding, PermissionFinding } from '../types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const BODY_BOTTOM = 785;
const BODY_WIDTH = PAGE_WIDTH - MARGIN * 2;

type PdfColor = [number, number, number];
type PdfFont = 'regular' | 'bold';
type PreparedLine = { text: string; size: number; font: PdfFont; color: PdfColor; indent?: number };
type Page = { commands: string[]; cursor: number };

const COLORS = {
  ink: [0.15, 0.11, 0.16] as PdfColor,
  secondary: [0.38, 0.32, 0.38] as PdfColor,
  muted: [0.48, 0.41, 0.48] as PdfColor,
  purple: [0.40, 0.29, 0.72] as PdfColor,
  orange: [0.78, 0.38, 0.12] as PdfColor,
  cream: [1.00, 0.96, 0.89] as PdfColor,
  lavender: [0.95, 0.90, 0.97] as PdfColor,
  card: [1.00, 0.985, 0.96] as PdfColor,
  border: [0.88, 0.79, 0.86] as PdfColor,
  green: [0.10, 0.43, 0.30] as PdfColor,
  amber: [0.60, 0.37, 0.05] as PdfColor,
  red: [0.68, 0.20, 0.23] as PdfColor,
};

function safeText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'N/A';
}

function pdfEscape(value: string): string {
  return safeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgb(color: PdfColor): string {
  return color.map((part) => part.toFixed(3)).join(' ');
}

function textCommand(text: string, x: number, top: number, size: number, font: PdfFont, color: PdfColor): string {
  const y = PAGE_HEIGHT - top - size;
  const pdfFont = font === 'bold' ? 'F2' : 'F1';
  return `BT /${pdfFont} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj ET\n`;
}

function rectCommand(x: number, top: number, width: number, height: number, color: PdfColor): string {
  const y = PAGE_HEIGHT - top - height;
  return `q ${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;
}

function lineCommand(x1: number, top: number, x2: number, color: PdfColor): string {
  const y = PAGE_HEIGHT - top;
  return `q ${rgb(color)} RG 0.6 w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S Q\n`;
}

function wrapText(value: string, fontSize: number, indent = 0): string[] {
  const safe = safeText(value);
  const maxChars = Math.max(24, Math.floor((BODY_WIDTH - indent) / (fontSize * 0.51)));
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxChars) {
        const chunk = word.slice(index, index + maxChars);
        if (chunk.length === maxChars) lines.push(chunk);
        else line = chunk;
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['N/A'];
}

function makeTextLines(text: string, options: Partial<Omit<PreparedLine, 'text'>> = {}): PreparedLine[] {
  const size = options.size ?? 9;
  const indent = options.indent ?? 0;
  return wrapText(text, size, indent).map((line) => ({
    text: line,
    size,
    font: options.font ?? 'regular',
    color: options.color ?? COLORS.secondary,
    indent,
  }));
}

function getSeverityColor(band: string): PdfColor {
  const value = band.toLowerCase();
  if (value.includes('high') || value.includes('critical')) return COLORS.red;
  if (value.includes('medium') || value.includes('context')) return COLORS.amber;
  if (value.includes('low') || value.includes('expected')) return COLORS.green;
  return COLORS.secondary;
}

function permissionLines(finding: PermissionFinding): PreparedLine[] {
  const header = `${safeText(finding.label)}  |  ${safeText(finding.status).toUpperCase()}  |  ${safeText(finding.severity).toUpperCase()}`;
  const rows: PreparedLine[] = [
    ...makeTextLines(header, { size: 9.5, font: 'bold', color: getSeverityColor(finding.severity) }),
    ...makeTextLines(`Permission identifier: ${finding.permission}`, { size: 8, color: COLORS.purple }),
    ...makeTextLines(`Classification: ${finding.status} | Severity: ${finding.severity} | Base weight: ${finding.base_weight}`),
    ...makeTextLines(`Confidence: ${finding.confidence || 'Not recorded'}`),
    ...makeTextLines(`Reason: ${finding.reason || 'No rationale was returned.'}`),
    ...makeTextLines(`Evidence rule IDs: ${(finding.evidence_rule_ids || []).join(', ') || 'None recorded'}`, { size: 8 }),
  ];
  if (finding.data_exposed) rows.push(...makeTextLines(`Data exposed: ${finding.data_exposed}`));
  if (finding.recommendation) rows.push(...makeTextLines(`Recommendation: ${finding.recommendation}`, { color: COLORS.purple }));
  if (finding.caveat) rows.push(...makeTextLines(`Caveat: ${finding.caveat}`, { size: 8, color: COLORS.muted }));
  return rows;
}

function combinationLines(finding: CombinationFinding): PreparedLine[] {
  const rows: PreparedLine[] = [
    ...makeTextLines(`${finding.rule_id}  |  ${safeText(finding.severity).toUpperCase()}`, { size: 9.5, font: 'bold', color: COLORS.purple }),
    ...makeTextLines(`Matched permissions: ${(finding.matched_permissions || []).join(', ') || 'N/A'}`, { size: 8 }),
    ...makeTextLines(`Confidence: ${finding.confidence || 'Not recorded'}`),
    ...makeTextLines(`Explanation: ${finding.explanation || 'No explanation was returned.'}`),
  ];
  if (finding.recommendation) rows.push(...makeTextLines(`Recommendation: ${finding.recommendation}`, { color: COLORS.purple }));
  return rows;
}

function buildPdf(app: AppAnalysis): string {
  const pages: Page[] = [];
  let page!: Page;

  const newPage = () => {
    page = { commands: [], cursor: 78 };
    pages.push(page);
    page.commands.push(rectCommand(0, 0, PAGE_WIDTH, 65, COLORS.cream));
    page.commands.push(rectCommand(0, 63, PAGE_WIDTH, 2, COLORS.orange));
    page.commands.push(textCommand('PERMISSION SENTINEL', MARGIN, 15, 12, 'bold', COLORS.orange));
    page.commands.push(textCommand('APPLICATION SECURITY REPORT', MARGIN, 37, 9, 'regular', COLORS.purple));
    page.commands.push(textCommand('EXPLAINABLE ANDROID PERMISSION AUDIT', PAGE_WIDTH - MARGIN - 190, 25, 7.5, 'regular', COLORS.muted));
  };
  newPage();

  const ensureSpace = (height: number) => {
    if (page.cursor + height > BODY_BOTTOM) newPage();
  };

  const drawTextLines = (lines: PreparedLine[], gapAfter = 0) => {
    for (const item of lines) {
      const lineHeight = item.size + 4;
      ensureSpace(lineHeight);
      page.commands.push(textCommand(item.text, MARGIN + (item.indent ?? 0), page.cursor, item.size, item.font, item.color));
      page.cursor += lineHeight;
    }
    page.cursor += gapAfter;
  };

  const paragraph = (text: string, options: Partial<Omit<PreparedLine, 'text'>> = {}, gapAfter = 3) => {
    drawTextLines(makeTextLines(text, options), gapAfter);
  };

  const section = (title: string, reserve = 92) => {
    ensureSpace(reserve);
    page.commands.push(rectCommand(MARGIN, page.cursor, BODY_WIDTH, 25, COLORS.lavender));
    page.commands.push(rectCommand(MARGIN, page.cursor, 3, 25, COLORS.orange));
    page.commands.push(textCommand(title, MARGIN + 12, page.cursor + 5, 10.5, 'bold', COLORS.purple));
    page.cursor += 34;
  };

  const addCardLines = (lines: PreparedLine[]) => {
    const lineHeight = lines.reduce((sum, line) => sum + line.size + 4, 0);
    const height = lineHeight + 20;
    if (page.cursor + height > BODY_BOTTOM) newPage();
    // Cards normally fit on one page. Fall back to unboxed lines for an unusually long entry.
    if (height > BODY_BOTTOM - 86) {
      drawTextLines(lines, 8);
      return;
    }
    page.commands.push(rectCommand(MARGIN, page.cursor, BODY_WIDTH, height, COLORS.card));
    page.commands.push(rectCommand(MARGIN, page.cursor, 3, height, COLORS.border));
    page.cursor += 8;
    drawTextLines(lines.map((line) => ({ ...line, indent: (line.indent ?? 0) + 8 })));
    page.cursor += 8;
    page.cursor += 4;
  };

  // Application identity and scan metadata.
  paragraph(app.app_name || 'Application Security Report', { size: 20, font: 'bold', color: COLORS.ink }, 2);
  paragraph(`Package: ${app.package_name || 'Unknown package'}`, { size: 9, font: 'regular', color: COLORS.purple }, 2);
  paragraph(`Declared purpose: ${app.selected_purpose || 'Not specified'} | Purpose source: ${app.purpose_source || 'N/A'}`, { size: 8.5 });
  paragraph(`Input source: ${app.input_source || 'N/A'} | App version: ${app.version || 'N/A'} | Target SDK: ${app.target_sdk || 'N/A'}`, { size: 8.5 });
  paragraph(`Scan timestamp: ${app.created_at ? new Date(app.created_at).toLocaleString() : 'Not recorded'}`, { size: 8.5 });
  paragraph(`Knowledge base version: ${app.knowledge_base_version || 'N/A'} | Report exported: ${new Date().toLocaleString()}`, { size: 8, color: COLORS.muted }, 8);

  ensureSpace(78);
  page.commands.push(rectCommand(MARGIN, page.cursor, BODY_WIDTH, 66, COLORS.lavender));
  page.commands.push(rectCommand(MARGIN, page.cursor, 5, 66, COLORS.orange));
  page.commands.push(textCommand('OVERALL RISK ASSESSMENT', MARGIN + 17, page.cursor + 9, 8, 'bold', COLORS.purple));
  page.commands.push(textCommand(`${Math.max(0, Math.min(100, Number(app.score) || 0))}/100`, MARGIN + 17, page.cursor + 25, 22, 'bold', COLORS.ink));
  page.commands.push(textCommand(`Severity: ${safeText(app.risk_band).toUpperCase()}`, MARGIN + 115, page.cursor + 32, 11, 'bold', getSeverityColor(app.risk_band)));
  page.commands.push(textCommand(`${app.permissions_raw?.length ?? 0} declared permissions  |  ${app.permission_findings?.length ?? 0} permission findings  |  ${app.combination_findings?.length ?? 0} combination findings`, MARGIN + 17, page.cursor + 51, 7.5, 'regular', COLORS.secondary));
  page.cursor += 78;

  const breakdown = app.score_breakdown || ({} as AppAnalysis['score_breakdown']);
  section('Risk Score Breakdown');
  const scoreRows: Array<[string, unknown]> = [
    ['Sensitivity contribution', breakdown.sensitivity_score],
    ['Purpose mismatch contribution', breakdown.purpose_mismatch_score],
    ['Risky permission combinations', breakdown.combination_score],
    ['Policy violation contribution', breakdown.policy_violation_score],
    ['Context amplifiers', breakdown.context_amplifier_score],
    ['Total score (clamped 0-100)', breakdown.total ?? app.score],
  ];
  for (const [label, value] of scoreRows) {
    paragraph(`${label}: ${value ?? 0}`, { size: 9, font: label.startsWith('Total') ? 'bold' : 'regular', color: label.startsWith('Total') ? COLORS.purple : COLORS.secondary }, 1);
  }
  const detail = breakdown.details;
  if (detail) {
    if (detail.sensitivity_permissions?.length) paragraph(`Top sensitivity weights: ${detail.sensitivity_permissions.map((item) => `${item.permission} (${item.weight})`).join('; ')}`, { size: 8 });
    if (detail.unexpected_permissions?.length) paragraph(`Unexpected permissions: ${detail.unexpected_permissions.join(', ')}`, { size: 8 });
    if (detail.combination_rules_triggered?.length) paragraph(`Combination rules triggered: ${detail.combination_rules_triggered.join(', ')}`, { size: 8 });
    if (detail.policy_violations?.length) paragraph(`Policy violations: ${detail.policy_violations.join(', ')}`, { size: 8 });
    if (detail.context_amplifiers?.length) paragraph(`Context amplifiers: ${detail.context_amplifiers.map((item) => `${item.reason} (+${item.contribution})`).join('; ')}`, { size: 8 });
  }

  section(`Permission Classifications & Findings (${app.permission_findings?.length ?? 0})`);
  if (!app.permission_findings?.length) {
    paragraph('No permission findings were returned by the analysis.', { size: 9 });
  } else {
    for (const finding of app.permission_findings) addCardLines(permissionLines(finding));
  }

  section(`Suspicious Permission Combinations (${app.combination_findings?.length ?? 0})`);
  if (!app.combination_findings?.length) {
    paragraph('No configured risky permission combinations were detected.', { size: 9 });
  } else {
    for (const combination of app.combination_findings) addCardLines(combinationLines(combination));
  }

  const findings = app.permission_findings || [];
  const unknownFindings = findings.filter((finding) => finding.status === 'unknown');
  const findingSet = new Set(findings.map((finding) => finding.permission));
  const notClassified = (app.permissions_raw || []).filter((permission) => !findingSet.has(permission));
  section('Unknown Permissions, Metadata & Limitations', 140);
  paragraph(`Unknown/unclassified findings: ${unknownFindings.length ? unknownFindings.map((finding) => finding.permission).join(', ') : 'None returned with unknown classification.'}`, { size: 8.5 });
  paragraph(`Declared permissions not represented in the finding list: ${notClassified.length ? notClassified.join(', ') : 'None identified.'}`, { size: 8.5 });
  paragraph(`Metadata: ${JSON.stringify(app.metadata_json || {})}`, { size: 7.5, color: COLORS.muted });
  paragraph('This report assesses declared permission metadata using Permission Sentinel rules, selected application purpose, and the active knowledge base. Declared permissions do not prove that the app accessed or transmitted the associated data. Static analysis cannot establish all runtime behaviour, user-granted states, server-side behaviour, or intent. Treat flagged combinations as indicators for review, not proof of maliciousness.', { size: 8.5 });
  if (app.user_notes) {
    section('Auditor Notes');
    paragraph(app.user_notes, { size: 8.5 });
  }

  // Append a footer to every page after the page count is final.
  pages.forEach((current, index) => {
    current.commands.push(lineCommand(MARGIN, 801, PAGE_WIDTH - MARGIN, COLORS.border));
    current.commands.push(textCommand('Permission Sentinel | Static permission analysis - review findings before remediation', MARGIN, 811, 7.2, 'regular', COLORS.muted));
    current.commands.push(textCommand(`Page ${index + 1} of ${pages.length}`, PAGE_WIDTH - MARGIN - 58, 811, 7.2, 'bold', COLORS.purple));
  });

  const objectBodies: string[] = [];
  objectBodies[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  objectBodies[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objectBodies[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objectBodies[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  pages.forEach((current, index) => {
    const pageObjectId = 5 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = current.commands.join('');
    objectBodies[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objectBodies[contentObjectId] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });

  let pdf = '%PDF-1.4\n%PSentinel\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objectBodies.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objectBodies[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectBodies.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectBodies.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectBodies.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getFilename(app: AppAnalysis, extension: string): string {
  const base = safeText(app.package_name || app.app_name || 'permission-sentinel-report')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'permission-sentinel-report';
  return `${base}_report.${extension}`;
}

/** Download the actual analysis record currently loaded by the report screen. */
export function downloadAnalysisJson(app: AppAnalysis): void {
  const payload = {
    report_schema: 'permission-sentinel.analysis.v1',
    exported_at: new Date().toISOString(),
    analysis: app,
    export_notes: 'This export contains the current analysis response, including permission identifiers, classifications, risk breakdown, evidence rules, confidence, combination findings, and available metadata.',
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }), getFilename(app, 'json'));
}

/** Generate a multi-page PDF from the actual report data displayed in AppDetail. */
export function downloadAnalysisPdf(app: AppAnalysis): void {
  const pdf = buildPdf(app);
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), getFilename(app, 'pdf'));
}
