import React, { useState, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType, ShadingType, BorderStyle } from 'docx';
import { AnalysisResult, LeakageCategory, Recommendation, BusinessSnapshot, LeadScoringAnalysis } from '../types';
import { LeakageChart } from './LeakageChart';
import { RefreshCw, AlertTriangle, Users, Briefcase, DollarSign, ShoppingCart, Activity, Target, Cpu, Zap, Loader2, MessageSquare, FileText, X, FileEdit, Printer, BookOpen } from 'lucide-react';

interface DashboardProps {
  data: AnalysisResult;
  onRestart: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onRestart }) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [printOnOpen, setPrintOnOpen] = useState(false);

  const handleDownloadDocx = async () => {
    setIsDownloading(true);

    try {
      const cleanName = (data.businessName || 'MLOT_Report').replace(/[^a-z0-9]/gi, '_');
      const dateStr = new Date().toLocaleDateString();

      type Align = typeof AlignmentType[keyof typeof AlignmentType];
      const P = (text: string, opts: { bold?: boolean; size?: number; italic?: boolean; alignment?: Align; spacingAfter?: number } = {}) =>
        new Paragraph({
          alignment: opts.alignment,
          spacing: { after: opts.spacingAfter ?? 160 },
          children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, size: opts.size ? opts.size * 2 : undefined })],
        });

      const H = (text: string) =>
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text, bold: true })] });

      // Plain-language callout: shaded single-cell box with a bold label.
      const callout = (label: string, text: string) =>
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: '888888' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888' },
            left: { style: BorderStyle.SINGLE, size: 6, color: '888888' },
            right: { style: BorderStyle.SINGLE, size: 6, color: '888888' },
          },
          rows: [new TableRow({ children: [new TableCell({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F4F1EA' },
            children: [new Paragraph({ spacing: { after: 0 }, children: [
              new TextRun({ text: `${label}  `, bold: true, size: 20 }),
              new TextRun({ text, size: 21 }),
            ] })],
          })] })],
        });

      const children: (Paragraph | Table)[] = [];

      // Cover
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "MLOT ANALYZER REPORT", bold: true })] }));
      children.push(P(data.businessName || "Your Business", { bold: true, size: 14, alignment: AlignmentType.CENTER }));
      children.push(P(`Generated on ${dateStr}`, { italic: true, size: 10, alignment: AlignmentType.CENTER, spacingAfter: 320 }));

      // Plain-language layer: Short Version, roadmap, plan at a glance, glossary
      children.push(H("The Short Version — The Whole Report in 30 Seconds"));
      shortVersion.forEach(line => children.push(P(`\u25B8 ${line}`, { spacingAfter: 80 })));
      children.push(H("How to Read This Report"));
      roadmap.forEach(([name, line]) => children.push(P(`${name} — ${line}.`, { spacingAfter: 60 })));
      children.push(P("In a hurry? Read the Short Version, the Bottom Line under the total, and the Strategic Action Plan checklist.", { italic: true, spacingAfter: 200 }));
      children.push(H("The Plan at a Glance"));
      children.push(P(flowSteps.map((s, i) => `${i + 1}. ${s}`).join('  \u2192  '), { spacingAfter: 200 }));
      children.push(H("Words We Use"));
      glossary.forEach(([term, def]) => children.push(P(`${term} — ${def}`, { spacingAfter: 60 })));

      // Executive summary
      children.push(H("Executive Summary"));
      children.push(P(data.executiveSummary || "", { spacingAfter: 240 }));
      children.push(P("Top Strategic Priorities:", { bold: true, spacingAfter: 120 }));
      (data.topPriorities || []).forEach((pr, i) => children.push(P(`${i + 1}. ${pr}`, { spacingAfter: 80 })));
      children.push(callout("IN PLAIN TERMS", inPlainTerms));

      // Total leakage callout
      children.push(H("Total Annual Leakage Identified"));
      children.push(P(formatCurrency(data.totalLeakage), { bold: true, size: 28, alignment: AlignmentType.CENTER }));
      children.push(P("Money currently left on the table", { alignment: AlignmentType.CENTER, spacingAfter: 320 }));
      children.push(callout("THE BOTTOM LINE", bottomLine));

      // Business snapshot
      if (data.businessSnapshot) {
        const s = data.businessSnapshot;
        children.push(H("Business Snapshot"));
        const cell = (label: string, value: string) =>
          new TableCell({ children: [P(label, { bold: true, size: 9, spacingAfter: 40 }), P(value || "N/A", { spacingAfter: 0 })] });
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [cell("Revenue", s.annualRevenue), cell("Employees", s.employeeCount), cell("Type", s.businessType)] }),
            new TableRow({ children: [cell("Customers/Mo", s.customersPerMonth), cell("Avg Transaction", s.avgTransactionValue), cell("Key Offerings", s.primaryProducts)] }),
          ],
        }));
      }

      // Leakage breakdown
      children.push(H("Financial Leakage Breakdown"));
      children.push(callout("\u26A0 WATCH OUT", watchOut));
      const headerShade = { type: ShadingType.CLEAR, color: 'auto', fill: 'E3DFD5' } as const;
      const totalShade = { type: ShadingType.CLEAR, color: 'auto', fill: 'F4F1EA' } as const;
      const headerRow = new TableRow({ children: ["Category", "Analysis", "Est. Loss"].map(t =>
        new TableCell({ shading: headerShade, children: [P(t, { bold: true, size: 10, spacingAfter: 0 })] })) });
      const leakRows = (data.leakageBreakdown || []).map(item => {
        const analysis = item.evidence ? `${item.description}\nFrom the interview: ${item.evidence}` : item.description;
        return new TableRow({ children: [
          new TableCell({ children: [P(item.category, { bold: true, size: 10, spacingAfter: 0 })] }),
          new TableCell({ children: [P(analysis, { size: 10, spacingAfter: 0 })] }),
          new TableCell({ children: [P(formatCurrency(item.estimatedLeakage), { bold: true, size: 10, spacingAfter: 0 })] }),
        ]});
      });
      const totalRow = new TableRow({ children: [
        new TableCell({ shading: totalShade, children: [P("Total", { bold: true, size: 10, spacingAfter: 0 })] }),
        new TableCell({ shading: totalShade, children: [P("", { spacingAfter: 0 })] }),
        new TableCell({ shading: totalShade, children: [P(formatCurrency(data.totalLeakage), { bold: true, size: 10, spacingAfter: 0 })] }),
      ]});
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...leakRows, totalRow] }));
      if (remember) children.push(callout("\u2605 REMEMBER", remember));

      // Lead scoring
      if (data.leadScoringAnalysis) {
        const ls = data.leadScoringAnalysis;
        children.push(H("AI Lead Scoring Plan"));
        children.push(P("Recommended Model:", { bold: true, spacingAfter: 40 }));
        children.push(P(ls.recommendedModel, { spacingAfter: 160 }));
        children.push(P("Key Signals:", { bold: true, spacingAfter: 40 }));
        (ls.keySignals || []).forEach(sig => children.push(P(`\u2022 ${sig}`, { spacingAfter: 40 })));
        children.push(P(`Potential uplift: ${ls.potentialConversionIncrease} conversion rate`, { bold: true, spacingAfter: 240 }));
      }

      // Recommendations
      children.push(H("Strategic Action Plan"));
      const sections: [string, Recommendation[]][] = [
        ["Leadership & Culture", data.recommendations?.leadership || []],
        ["Process Optimization", data.recommendations?.process || []],
        ["Sales & Marketing", data.recommendations?.marketing || []],
        ["Revenue Recovery", data.recommendations?.collections || []],
      ];
      sections.forEach(([title, items]) => {
        if (!items.length) return;
        children.push(P(title, { bold: true, size: 12, spacingAfter: 80 }));
        items.forEach(rec => {
          children.push(P(`\u2610 ${rec.title} [${rec.type}]`, { bold: true, size: 10, spacingAfter: 40 }));
          children.push(P(rec.description, { size: 10, spacingAfter: 160 }));
        });
      });

      // Transcript
      if (data.transcript && data.transcript.length > 0) {
        children.push(H("Diagnostic Transcript"));
        data.transcript.forEach(item => {
          children.push(P(`Q: ${item.question}`, { bold: true, size: 10, spacingAfter: 40 }));
          children.push(P(item.answer, { size: 10, spacingAfter: 160 }));
        });
      }

      // Contact + footer
      children.push(P("Questions about this report or want to discuss your results?", { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 40 }));
      children.push(P("Contact Keith Tully \u2014 PowerTies.us \u2014 keith@powerties.us \u2014 646.598.2834", { alignment: AlignmentType.CENTER, size: 10, spacingAfter: 320 }));
      children.push(P("End of Report \u2022 Generated by MLOT Analyzer", { alignment: AlignmentType.CENTER, size: 8, spacingAfter: 0 }));

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanName}_Analysis.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintFromDashboard = () => {
    // Open the report preview, then print the report (not the dashboard).
    setPrintOnOpen(true);
    setIsReportModalOpen(true);
  };

  useEffect(() => {
    if (printOnOpen && isReportModalOpen) {
      setPrintOnOpen(false);
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [printOnOpen, isReportModalOpen]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxLeakage = Math.max(...(data.leakageBreakdown?.map(i => i.estimatedLeakage) || [0]), 1);

  // ── Plain-language layer ─────────────────────────────────────────────
  // Presentation furniture only (Short Version, roadmap, callouts, bottom
  // line, checklist). Every string below is derived from this report's own
  // data — no new findings, figures, or claims are introduced.
  const leaks = data.leakageBreakdown || [];
  const topLeak = [...leaks].sort((a, b) => b.estimatedLeakage - a.estimatedLeakage)[0];
  const perMonth = data.totalLeakage / 12;
  const perWeek = data.totalLeakage / 52;
  const recGroupsAll: [string, Recommendation[]][] = [
    ['Leadership & Culture', data.recommendations?.leadership || []],
    ['Process', data.recommendations?.process || []],
    ['Marketing & Sales', data.recommendations?.marketing || []],
    ['Collections & Revenue', data.recommendations?.collections || []],
  ];
  const recCount = recGroupsAll.reduce((n, [, items]) => n + items.length, 0);
  const hasBiab = recGroupsAll.some(([, items]) => items.some(r => r.type === 'BIAB'));

  const shortVersion: string[] = [
    `An estimated ${formatCurrency(data.totalLeakage)} a year is leaking out of the business${leaks.length ? ` across ${leaks.length} area${leaks.length === 1 ? '' : 's'}` : ''}.`,
  ];
  if (topLeak) shortVersion.push(`${topLeak.category} is the biggest single leak, at ${formatCurrency(topLeak.estimatedLeakage)} a year.`);
  if (data.topPriorities?.[0]) shortVersion.push(`First thing to fix: ${data.topPriorities[0]}`);
  if (data.leadScoringAnalysis) shortVersion.push(`The proposed lead-scoring model carries a potential conversion uplift of ${data.leadScoringAnalysis.potentialConversionIncrease}.`);
  if (recCount) {
    const names = recGroupsAll.filter(([, items]) => items.length).map(([name]) => name.toLowerCase());
    shortVersion.push(`The action plan lists ${recCount} recommended action${recCount === 1 ? '' : 's'} across ${names.join(', ')}.`);
  }

  const roadmap: [string, string][] = [
    ['The Short Version', 'the whole report in 30 seconds'],
    ['Executive Summary', 'what the analysis found, and the priorities it points to'],
    ['The Money', 'the total left on the table, and what it means per month'],
    ...(data.businessSnapshot ? [['Business Snapshot', 'the facts about the business this report is based on']] as [string, string][] : []),
    ['Where the Money Leaks', 'each leak, its yearly cost, and the interview answers behind it'],
    ...(data.leadScoringAnalysis ? [['AI Lead Scoring Plan', 'how to rank new leads so the best ones get called first']] as [string, string][] : []),
    ['Strategic Action Plan', 'what to do about it — a checklist you can tick off'],
    ...(data.transcript && data.transcript.length > 0 ? [['Interview Transcript', 'every question and answer behind this report']] as [string, string][] : []),
  ];

  const flowSteps = ['Your interview answers', 'The leaks they point to', 'What each leak costs', 'The fix-it plan', 'Your first step'];

  const glossary: [string, string][] = [
    ['Leakage', 'money the business could have kept, lost through gaps in follow-up, process, or pricing.'],
    ['Estimate', 'a figure worked out from the answers given in the interview — not taken from the business\u2019s accounts.'],
    ...(data.leadScoringAnalysis ? [
      ['Lead scoring', 'ranking new enquiries so the ones most likely to buy get attention first.'],
      ['Conversion rate', 'out of every 100 enquiries, how many become paying customers.'],
    ] as [string, string][] : []),
    ...(hasBiab ? [['BIAB (Business In A Box)', 'a packaged, ready-to-use system, offered in some recommendations.']] as [string, string][] : []),
  ];

  const inPlainTerms = topLeak
    ? `Add up the leaks below and the total is ${formatCurrency(data.totalLeakage)} a year — about ${formatCurrency(perMonth)} a month. The biggest single piece is ${topLeak.category}, at ${formatCurrency(topLeak.estimatedLeakage)} a year.`
    : `The total identified below is ${formatCurrency(data.totalLeakage)} a year — about ${formatCurrency(perMonth)} a month.`;

  const bottomLine = `${formatCurrency(data.totalLeakage)} a year works out to about ${formatCurrency(perMonth)} a month, or ${formatCurrency(perWeek)} a week. Every month these leaks stay open, roughly another ${formatCurrency(perMonth)} slips away.`;

  const watchOut = 'Every figure in this report is an estimate, worked out from the answers given in the diagnostic interview. Use the numbers to decide where to look first — they are not taken from the business\u2019s bookkeeping, and the real figures may be higher or lower.';

  const remember = topLeak && data.totalLeakage > 0
    ? `One leak is bigger than the rest: ${topLeak.category}, at ${formatCurrency(topLeak.estimatedLeakage)} a year — ${Math.round((topLeak.estimatedLeakage / data.totalLeakage) * 100)}% of the total, and marked ${topLeak.priority} priority in the table.`
    : '';

  return (
    <div className="bg-slate-900 min-h-screen pb-20 relative overflow-x-hidden">
      {/* Web View Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
           <div>
             <h2 className="text-3xl font-bold text-white">Financial Analysis Report</h2>
             <p className="text-slate-400 mt-1">Generated for {data.businessName || "Your Business"}</p>
           </div>
           <div className="flex gap-3">
             <button 
               onClick={() => setIsReportModalOpen(true)}
               className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-emerald-900/20"
             >
               <FileText className="w-4 h-4" />
               View Full Report
             </button>
             <button
               onClick={handlePrintFromDashboard}
               className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors border border-slate-700"
             >
               <Printer className="w-4 h-4" />
               Print
             </button>
             <button 
               onClick={onRestart}
               className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors border border-slate-700"
             >
               <RefreshCw className="w-4 h-4" />
               New Analysis
             </button>
           </div>
        </div>

        {/* The Short Version — plain-language layer */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 border-l-4 border-l-[#C9A227] shadow-xl">
          <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
            <BookOpen className="w-5 h-5" />
            <h3 className="text-lg font-bold tracking-wide uppercase">The Short Version</h3>
          </div>
          <p className="text-slate-500 text-sm mb-4">The whole report in 30 seconds.</p>
          <ul className="space-y-2">
            {shortVersion.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-200 leading-relaxed">
                <span className="text-[#D4AF37] mt-0.5 flex-shrink-0">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-slate-500 text-sm mt-5">
            <span className="font-semibold text-slate-400">What this report covers: </span>
            {roadmap.map(([name]) => name).join(' · ')}
          </p>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] block mb-1">The Bottom Line</span>
            <p className="text-slate-200 leading-relaxed">{bottomLine}</p>
          </div>
        </div>

        {/* Business Snapshot Section */}
        {data.businessSnapshot && (
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <Activity className="w-5 h-5" />
              <h3 className="text-lg font-bold tracking-wide uppercase">Business Snapshot</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <SnapshotItem icon={<Briefcase />} label="Business Type" value={data.businessSnapshot.businessType} />
              <SnapshotItem icon={<DollarSign />} label="Annual Revenue" value={data.businessSnapshot.annualRevenue} />
              <SnapshotItem icon={<Users />} label="Employees" value={data.businessSnapshot.employeeCount} />
              <SnapshotItem icon={<Users />} label="Customers / Mo" value={data.businessSnapshot.customersPerMonth} />
              <SnapshotItem icon={<ShoppingCart />} label="Avg Transaction" value={data.businessSnapshot.avgTransactionValue} />
              <SnapshotItem icon={<Target />} label="Key Offerings" value={data.businessSnapshot.primaryProducts} />
            </div>
          </div>
        )}

        {/* Executive Summary & Total Leakage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h3 className="text-xl font-semibold text-emerald-400 mb-4">Executive Summary</h3>
            <p className="text-slate-300 leading-relaxed text-lg">
              {data.executiveSummary}
            </p>
            <div className="mt-6 bg-slate-900/50 border border-slate-700/60 rounded-lg p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] block mb-1">In Plain Terms</span>
              <p className="text-slate-300 leading-relaxed">{inPlainTerms}</p>
            </div>
            <div className="mt-6">
              <h4 className="text-sm font-uppercase tracking-wider text-slate-500 mb-3">TOP PRIORITIES</h4>
              <ol className="space-y-2">
                {data.topPriorities?.map((priority, idx) => (
                  <li key={idx} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 text-sm leading-relaxed">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                    <span>{priority}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/50 to-slate-900 rounded-2xl p-6 border border-red-900/30 shadow-xl flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
            <span className="text-red-300 font-medium text-sm uppercase tracking-widest mb-2">Total Estimated Leakage</span>
            <span className="text-5xl sm:text-6xl font-bold text-white tracking-tight drop-shadow-lg">
              {formatCurrency(data.totalLeakage)}
            </span>
            <span className="text-slate-400 text-sm mt-4">Annually Left on the Table</span>
          </div>
        </div>

        {/* AI Lead Scoring System Analysis */}
        {data.leadScoringAnalysis && (
          <div className="bg-gradient-to-r from-indigo-900/20 to-slate-800 rounded-2xl p-1 border border-indigo-500/20">
             <div className="bg-slate-800/90 rounded-xl p-6">
               <div className="flex flex-col md:flex-row gap-8">
                 <div className="flex-1">
                    <div className="flex items-center gap-2 text-indigo-400 mb-4">
                      <Cpu className="w-6 h-6" />
                      <h3 className="text-xl font-bold">Proposed AI Lead Scoring System</h3>
                    </div>
                    <p className="text-slate-300 mb-4 text-sm leading-relaxed">
                      <strong className="text-indigo-300">Current Gap:</strong> {data.leadScoringAnalysis.currentGap}
                    </p>
                    <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                      <strong className="text-indigo-300">Recommended Model:</strong> {data.leadScoringAnalysis.recommendedModel}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mt-6">
                       <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex-1">
                         <div className="text-indigo-400 text-xs uppercase font-bold mb-1">Implementation Strategy</div>
                         <div className="text-indigo-100 text-sm">{data.leadScoringAnalysis.implementationStrategy}</div>
                       </div>
                    </div>
                 </div>

                 <div className="w-full md:w-72 flex-shrink-0 bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" /> 
                      Key Signals to Track
                    </h4>
                    <ul className="space-y-2 mb-6">
                      {data.leadScoringAnalysis.keySignals?.map((signal, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-500 mt-1">•</span>
                          {signal}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-4 border-t border-slate-700/50 text-center">
                      <div className="text-slate-400 text-xs uppercase tracking-wide">Potential Uplift</div>
                      <div className="text-3xl font-bold text-emerald-400 mt-1">{data.leadScoringAnalysis.potentialConversionIncrease}</div>
                    </div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <LeakageChart data={data.leakageBreakdown || []} />
           
           <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 overflow-y-auto max-h-[400px] custom-scrollbar">
             <h3 className="text-lg font-semibold text-slate-200 mb-4 sticky top-0 bg-slate-800/95 pb-2 z-10">Leakage Breakdown</h3>
             <div className="space-y-4">
               {data.leakageBreakdown?.map((item, idx) => (
                 <div key={idx} className="flex items-start justify-between p-3 rounded-lg hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0">
                   <div>
                     <div className="font-medium text-slate-200">{item.category}</div>
                     <div className="text-sm text-slate-400 mt-1">{item.description}</div>
                     {item.evidence && (
                       <div className="text-xs text-slate-500 mt-1.5">
                         <span className="font-semibold uppercase tracking-wide text-slate-400">From the interview: </span>
                         {item.evidence}
                       </div>
                     )}
                   </div>
                   <div className="text-right flex-shrink-0 ml-4">
                     <div className="text-red-400 font-bold">{formatCurrency(item.estimatedLeakage)}</div>
                     <span className={`text-xs px-2 py-0.5 rounded-full ${
                       item.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                       item.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                       'bg-blue-500/20 text-blue-400'
                     }`}>
                       {item.priority} Priority
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>

        {/* Recommendations Grid */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">Strategic Recommendations</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecommendationCard title="Leadership & Culture" items={data.recommendations?.leadership || []} />
            <RecommendationCard title="Process & Efficiency" items={data.recommendations?.process || []} />
            <RecommendationCard title="Marketing & Sales" items={data.recommendations?.marketing || []} />
            <RecommendationCard title="Collections & Revenue" items={data.recommendations?.collections || []} />
          </div>
        </div>

        {/* Transcript Section (Web View) */}
        {data.transcript && data.transcript.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
              <MessageSquare className="w-6 h-6 text-slate-400" />
              <h3 className="text-2xl font-bold text-white">Diagnostic Interview Transcript</h3>
            </div>
            <div className="space-y-8">
              {data.transcript.map((item, idx) => (
                <div key={idx} className="border-b border-slate-700/50 last:border-0 pb-6 last:pb-0">
                  <p className="text-emerald-400 font-medium mb-3 leading-relaxed">
                    <span className="text-xs font-bold uppercase bg-emerald-900/30 text-emerald-500 px-2 py-1 rounded mr-2">Q</span>
                    {item.question}
                  </p>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold uppercase bg-indigo-900/30 text-indigo-400 px-2 py-1 rounded mt-1">A</span>
                    <p className="text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 w-full">
                      {item.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* REPORT PREVIEW MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex justify-center overflow-y-auto animate-in fade-in duration-200">
            
            {/* Modal Toolbar */}
            <div className="fixed top-0 left-0 w-full bg-slate-900 p-4 flex items-center justify-between text-white z-[101] border-b border-slate-800 shadow-lg no-print">
                <div className="flex items-center gap-2">
                   <FileText className="w-5 h-5 text-emerald-500" />
                   <span className="text-lg font-bold hidden sm:inline">Report Preview</span>
                </div>
                <div className="flex gap-3">
                   <button 
                     onClick={() => window.print()}
                     className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-emerald-900/20"
                   >
                     <Printer className="w-4 h-4" />
                     Print Report
                   </button>
                   <button 
                     onClick={handleDownloadDocx}
                     disabled={isDownloading}
                     className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-70 shadow-lg shadow-blue-900/20"
                   >
                     {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
                     {isDownloading ? 'Processing...' : 'Download Word Doc'}
                   </button>
                   <button 
                     onClick={() => setIsReportModalOpen(false)}
                     className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors border border-slate-700 hover:text-white"
                   >
                     <X className="w-4 h-4" />
                     Close
                   </button>
                </div>
            </div>

            {/* PRINT CONTENT CONTAINER */}
            {/* STRICT BLACK TEXT / WHITE BACKGROUND VERSION */}
            <div 
              id="printable-report-content" 
              className="bg-white text-black shadow-2xl mt-24 mb-20 mx-auto"
              style={{ 
                width: 'min(8.5in, 100%)', // Letter width on desktop/print, fluid on small screens
                minHeight: '11in',
                padding: '0.75in', 
                boxSizing: 'border-box',
                backgroundColor: 'white',
                color: 'black',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              {/* Cover/Header */}
              <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #000000', paddingBottom: '20px', backgroundColor: '#ffffff' }}>
                <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: '0 0 10px 0', color: '#000000', textTransform: 'uppercase', letterSpacing: '2px', backgroundColor: '#ffffff' }}>MLOT Analyzer Report</h1>
                <p style={{ fontSize: '14pt', color: '#000000', margin: '0', fontWeight: 'bold', backgroundColor: '#ffffff' }}>{data.businessName}</p>
                <p style={{ fontSize: '10pt', color: '#000000', margin: '10px 0 0 0', fontStyle: 'italic', backgroundColor: '#ffffff' }}>Generated on {new Date().toLocaleDateString()}</p>
              </div>

              {/* The Short Version — plain-language layer */}
              <div style={{ marginBottom: '30px', border: '2px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '4px', backgroundColor: '#ffffff' }}>The Short Version</span>
                <span style={{ fontSize: '9pt', fontStyle: 'italic', color: '#000000', display: 'block', marginBottom: '10px', backgroundColor: '#ffffff' }}>The whole report in 30 seconds.</span>
                {shortVersion.map((line, i) => (
                  <div key={i} style={{ fontSize: '10.5pt', lineHeight: 1.5, color: '#000000', marginBottom: i === shortVersion.length - 1 ? 0 : '6px', backgroundColor: '#ffffff' }}>▸ {line}</div>
                ))}
              </div>

              {/* How to Read This Report — plain-language layer */}
              <div style={{ marginBottom: '30px', border: '1px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '10px', backgroundColor: '#ffffff' }}>How to Read This Report</span>
                {roadmap.map(([name, line], i) => (
                  <div key={i} style={{ fontSize: '10pt', lineHeight: 1.5, color: '#000000', marginBottom: '4px', backgroundColor: '#ffffff' }}><strong>{name}</strong> — {line}.</div>
                ))}
                <div style={{ fontSize: '10pt', fontStyle: 'italic', color: '#000000', marginTop: '8px', backgroundColor: '#ffffff' }}>In a hurry? Read the Short Version, the Bottom Line under the total, and the Strategic Action Plan checklist.</div>
              </div>

              {/* The Plan at a Glance — plain-language layer */}
              <div style={{ marginBottom: '30px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '8px', backgroundColor: '#ffffff' }}>The Plan at a Glance</span>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                  <tbody>
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      {flowSteps.map((step, i) => (
                        <React.Fragment key={i}>
                          <td style={{ width: '18%', border: '1px solid #000000', padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', color: '#000000', backgroundColor: '#ffffff' }}>
                            <div style={{ fontSize: '14pt', fontWeight: 'bold', lineHeight: 1, color: '#000000', backgroundColor: '#ffffff' }}>{i + 1}</div>
                            <div style={{ fontSize: '8.5pt', lineHeight: 1.3, marginTop: '4px', color: '#000000', backgroundColor: '#ffffff' }}>{step}</div>
                          </td>
                          {i < flowSteps.length - 1 && (
                            <td style={{ width: '2.5%', textAlign: 'center', verticalAlign: 'middle', fontSize: '12pt', color: '#000000', backgroundColor: '#ffffff' }}>→</td>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Words We Use — plain-language layer */}
              <div style={{ marginBottom: '40px', border: '1px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '10px', backgroundColor: '#ffffff' }}>Words We Use</span>
                {glossary.map(([term, def], i) => (
                  <div key={i} style={{ fontSize: '10pt', lineHeight: 1.5, color: '#000000', marginBottom: i === glossary.length - 1 ? 0 : '4px', backgroundColor: '#ffffff' }}><strong>{term}</strong> — {def}</div>
                ))}
              </div>

              {/* Executive Summary */}
              <div style={{ marginBottom: '40px', backgroundColor: '#ffffff' }}>
                <h2 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '15px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Executive Summary</h2>
                <p style={{ fontSize: '11pt', lineHeight: '1.5', color: '#000000', textAlign: 'justify', marginBottom: '20px', backgroundColor: '#ffffff' }}>{data.executiveSummary}</p>
                
                <div style={{ border: '1px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                   <span style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '10px', backgroundColor: '#ffffff' }}>Top Strategic Priorities:</span>
                   {data.topPriorities?.map((p, i, arr) => (
                     <div
                       key={i}
                       style={{
                         display: 'block',
                         backgroundColor: '#ffffff',
                         color: '#000000',
                         border: '1px solid #000000',
                         padding: '8px 12px',
                         fontSize: '10pt',
                         lineHeight: 1.4,
                         marginBottom: i === arr.length - 1 ? 0 : '8px',
                       }}
                     >
                       {i + 1}. {p}
                     </div>
                   ))}
                </div>
              </div>

              {/* In Plain Terms — plain-language layer */}
              <div style={{ marginBottom: '40px', border: '1px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '6px', backgroundColor: '#ffffff' }}>In Plain Terms</span>
                <p style={{ fontSize: '11pt', lineHeight: '1.5', color: '#000000', margin: '0', backgroundColor: '#ffffff' }}>{inPlainTerms}</p>
              </div>

              {/* Total Leakage Callout */}
              <div style={{ marginBottom: '40px', borderTop: '1px solid #000000', borderBottom: '1px solid #000000', padding: '30px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 10px 0', border: 'none', backgroundColor: '#ffffff' }}>Total Annual Leakage Identified</h2>
                <div style={{ fontSize: '36pt', fontWeight: '900', color: '#000000', margin: '15px 0', backgroundColor: '#ffffff' }}>{formatCurrency(data.totalLeakage)}</div>
                <p style={{ fontSize: '10pt', color: '#000000', margin: '0', backgroundColor: '#ffffff' }}>Money currently left on the table</p>
              </div>

              {/* The Bottom Line — plain-language layer */}
              <div style={{ marginBottom: '40px', border: '2px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '6px', backgroundColor: '#ffffff' }}>The Bottom Line</span>
                <p style={{ fontSize: '11pt', lineHeight: '1.5', color: '#000000', margin: '0', backgroundColor: '#ffffff' }}>{bottomLine}</p>
              </div>

              {/* Business Snapshot */}
              {data.businessSnapshot && (
                <div style={{ marginBottom: '40px', backgroundColor: '#ffffff' }}>
                   <h2 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '15px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Business Snapshot</h2>
                   <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', backgroundColor: '#ffffff' }}>
                     <tbody>
                       <tr style={{ borderBottom: '1px solid #000000', backgroundColor: '#ffffff' }}>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', borderRight: '1px solid #000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                           <div style={{ fontSize: '9pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Revenue</div>
                           <div style={{ fontSize: '11pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.businessSnapshot.annualRevenue}</div>
                         </td>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', borderRight: '1px solid #000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                           <div style={{ fontSize: '9pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Employees</div>
                           <div style={{ fontSize: '11pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.businessSnapshot.employeeCount}</div>
                         </td>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                           <div style={{ fontSize: '9pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Type</div>
                           <div style={{ fontSize: '11pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.businessSnapshot.businessType}</div>
                         </td>
                       </tr>
                       <tr style={{ backgroundColor: '#ffffff' }}>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', borderRight: '1px solid #000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                           <div style={{ fontSize: '9pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Customers/Mo</div>
                           <div style={{ fontSize: '11pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.businessSnapshot.customersPerMonth}</div>
                         </td>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', borderRight: '1px solid #000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                           <div style={{ fontSize: '9pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Avg Transaction</div>
                           <div style={{ fontSize: '11pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.businessSnapshot.avgTransactionValue}</div>
                         </td>
                         <td style={{ width: '33%', padding: '10px', color: '#000000', verticalAlign: 'top', backgroundColor: '#ffffff' }}>
                            {/* Empty cell or key product */}
                         </td>
                       </tr>
                     </tbody>
                   </table>
                </div>
              )}

              {/* Leakage Breakdown Table */}
              <div style={{ marginBottom: '40px', backgroundColor: '#ffffff' }}>
                <h2 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '15px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Financial Leakage Breakdown</h2>
                <p style={{ fontSize: '10pt', lineHeight: '1.5', color: '#000000', marginBottom: '12px', backgroundColor: '#ffffff' }}><strong>⚠ Watch Out —</strong> {watchOut}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', backgroundColor: '#ffffff' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000000', backgroundColor: '#ffffff' }}>
                      <th style={{ padding: '8px', textAlign: 'left', width: '25%', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '9pt', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}>Category</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '55%', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '9pt', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}>Analysis</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '20%', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '9pt', backgroundColor: '#ffffff' }}>Est. Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leakageBreakdown?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #000000', backgroundColor: '#ffffff' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#000000', verticalAlign: 'top', borderRight: '1px solid #000000', fontSize: '10pt', backgroundColor: '#ffffff' }}>{item.category}</td>
                        <td style={{ padding: '8px', color: '#000000', fontSize: '10pt', verticalAlign: 'top', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}>
                          <div style={{ marginBottom: '6px', backgroundColor: '#ffffff' }}>{item.description}</div>
                          {item.evidence && (
                            <div style={{ marginBottom: '6px', fontSize: '9pt', fontStyle: 'italic', backgroundColor: '#ffffff' }}>
                              <span style={{ fontWeight: 'bold', fontStyle: 'normal', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>From the interview: </span>
                              {item.evidence}
                            </div>
                          )}
                          {/* Visual Bar - Black */}
                          <div style={{ width: '100%', height: '6px', border: '1px solid #000000', display: 'flex', backgroundColor: '#ffffff' }}>
                             <div style={{ width: `${Math.max((item.estimatedLeakage / maxLeakage) * 100, 1)}%`, backgroundColor: '#000000', height: '100%' }}></div>
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#000000', fontSize: '10pt', verticalAlign: 'top', backgroundColor: '#ffffff' }}>{formatCurrency(item.estimatedLeakage)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #000000', backgroundColor: '#ffffff' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', fontSize: '10pt', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}>Total</td>
                      <td style={{ padding: '8px', color: '#000000', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}></td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#000000', fontSize: '10pt', backgroundColor: '#ffffff' }}>{formatCurrency(data.totalLeakage)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remember — plain-language layer */}
              {remember && (
                <div style={{ marginBottom: '40px', border: '1px solid #000000', padding: '15px', backgroundColor: '#ffffff' }}>
                  <span style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: '6px', backgroundColor: '#ffffff' }}>★ Remember</span>
                  <p style={{ fontSize: '10.5pt', lineHeight: '1.5', color: '#000000', margin: '0', backgroundColor: '#ffffff' }}>{remember}</p>
                </div>
              )}

              {/* Lead Scoring Section */}
              {data.leadScoringAnalysis && (
                <div style={{ marginBottom: '40px', border: '1px solid #000000', padding: '20px', pageBreakInside: 'avoid', backgroundColor: '#ffffff' }}>
                   <h2 style={{ fontSize: '13pt', fontWeight: 'bold', color: '#000000', margin: '0 0 15px 0', borderBottom: '1px solid #000000', paddingBottom: '8px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>AI Lead Scoring Plan</h2>
                   <table style={{ width: '100%', backgroundColor: '#ffffff' }}>
                     <tbody>
                       <tr style={{ backgroundColor: '#ffffff' }}>
                         <td style={{ verticalAlign: 'top', paddingRight: '20px', color: '#000000', backgroundColor: '#ffffff' }}>
                            <div style={{ marginBottom: '15px', backgroundColor: '#ffffff' }}>
                               <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Recommended Model</div>
                               <div style={{ fontSize: '10pt', color: '#000000', backgroundColor: '#ffffff' }}>{data.leadScoringAnalysis.recommendedModel}</div>
                            </div>
                            <div style={{ backgroundColor: '#ffffff' }}>
                               <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', marginBottom: '4px', backgroundColor: '#ffffff' }}>Key Signals</div>
                               <ul style={{ margin: '5px 0 0 0', paddingLeft: '15px', color: '#000000', fontSize: '10pt', backgroundColor: '#ffffff' }}>
                                 {data.leadScoringAnalysis.keySignals?.map(s => <li key={s} style={{ backgroundColor: '#ffffff' }}>{s}</li>)}
                               </ul>
                            </div>
                         </td>
                         <td style={{ width: '150px', verticalAlign: 'top', border: '1px solid #000000', padding: '15px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                            <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Potential Uplift</div>
                            <div style={{ fontSize: '20pt', fontWeight: 'bold', color: '#000000', margin: '10px 0', backgroundColor: '#ffffff' }}>{data.leadScoringAnalysis.potentialConversionIncrease}</div>
                            <div style={{ fontSize: '8pt', color: '#000000', backgroundColor: '#ffffff' }}>Conversion Rate</div>
                         </td>
                       </tr>
                     </tbody>
                   </table>
                </div>
              )}

              {/* Recommendations */}
              <div style={{ marginBottom: '30px', backgroundColor: '#ffffff' }}>
                <h2 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '20px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Strategic Action Plan</h2>
                
                <PrintSection title="Leadership & Culture" items={data.recommendations?.leadership || []} />
                <PrintSection title="Process Optimization" items={data.recommendations?.process || []} />
                <PrintSection title="Sales & Marketing" items={data.recommendations?.marketing || []} />
                <PrintSection title="Revenue Recovery" items={data.recommendations?.collections || []} />
              </div>

              {/* Transcript */}
              {data.transcript && data.transcript.length > 0 && (
                <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px solid #000000', backgroundColor: '#ffffff' }}>
                   <h2 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', marginBottom: '20px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Diagnostic Transcript</h2>
                   {data.transcript.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: '15px', pageBreakInside: 'avoid', borderBottom: '1px solid #eeeeee', paddingBottom: '10px', backgroundColor: '#ffffff' }}>
                         <div style={{ fontWeight: 'bold', color: '#000000', marginBottom: '4px', fontSize: '10pt', backgroundColor: '#ffffff' }}>Q: {item.question}</div>
                         <div style={{ paddingLeft: '10px', borderLeft: '2px solid #000000', color: '#000000', fontSize: '10pt', backgroundColor: '#ffffff' }}>{item.answer}</div>
                      </div>
                   ))}
                </div>
              )}

              {/* Contact block - final content element; flows into the Word export like the rest of the report */}
              <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #000000', backgroundColor: '#ffffff' }}>
                <p style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', margin: '0 0 6px 0', backgroundColor: '#ffffff' }}>
                  Questions about this report or want to discuss your results?
                </p>
                <p style={{ fontSize: '10pt', color: '#000000', margin: '0', backgroundColor: '#ffffff' }}>
                  Contact Keith Tully — PowerTies.us — keith@powerties.us — 646.598.2834
                </p>
              </div>

              <div style={{ textAlign: 'center', marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #000000', color: '#000000', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: '#ffffff' }}>
                End of Report • Generated by MLOT Analyzer
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

const SnapshotItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 rounded-lg bg-slate-700/50 text-emerald-400 border border-slate-600/50">
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </div>
    <div>
      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">{label}</p>
      <p className="text-white font-medium text-sm sm:text-base line-clamp-2">{value || 'N/A'}</p>
    </div>
  </div>
);

const RecommendationCard: React.FC<{ title: string, items: Recommendation[] }> = ({ title, items }) => (
  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-emerald-500/30 transition-colors">
    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      {title}
    </h4>
    <ul className="space-y-4">
      {items.map((rec, idx) => (
        <li key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex justify-between items-start mb-1">
            <span className="font-semibold text-emerald-400"><span className="text-slate-500 mr-1.5">☐</span>{rec.title}</span>
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-700 text-slate-300">
              {rec.type}
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{rec.description}</p>
        </li>
      ))}
    </ul>
  </div>
);

const PrintSection: React.FC<{ title: string, items: Recommendation[] }> = ({ title, items }) => (
  <div style={{ marginBottom: '25px', pageBreakInside: 'avoid', backgroundColor: '#ffffff' }}>
    <h3 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '10px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>{title}</h3>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, backgroundColor: '#ffffff' }}>
      {items.map((rec, idx) => (
        <li key={idx} style={{ marginBottom: '15px', padding: '0 0 10px 0', borderBottom: '1px dotted #000000', pageBreakInside: 'avoid', backgroundColor: '#ffffff' }}>
          <table style={{ width: '100%', marginBottom: '4px', backgroundColor: '#ffffff' }}>
            <tbody>
              <tr style={{ backgroundColor: '#ffffff' }}>
                <td style={{ fontWeight: 'bold', color: '#000000', fontSize: '10pt', border: 'none', padding: 0, backgroundColor: '#ffffff' }}>☐ {rec.title}</td>
                <td style={{ textAlign: 'right', width: '100px', border: 'none', padding: 0, backgroundColor: '#ffffff' }}>
                   <span style={{ fontSize: '8pt', color: '#000000', border: '1px solid #000000', padding: '2px 6px', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>
                     {rec.type}
                   </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: '0', fontSize: '10pt', color: '#000000', lineHeight: '1.4', textAlign: 'left', backgroundColor: '#ffffff' }}>{rec.description}</p>
        </li>
      ))}
    </ul>
  </div>
);