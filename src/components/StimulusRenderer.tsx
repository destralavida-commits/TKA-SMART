import React, { useState } from 'react';
import { BookOpen, Image as ImageIcon } from 'lucide-react';
import type { StimulusChartData, StimulusTableData, StimulusType } from '../types/tka';

export interface StimulusDisplayData {
  title: string;
  stimulusType: StimulusType;
  readingText?: string;
  imageUrl?: string;
  tableData?: StimulusTableData;
  chartData?: StimulusChartData;
  diagramSvg?: string;
}

export function StimulusRenderer({
  stimulus,
  compact = false,
}: {
  stimulus?: StimulusDisplayData | null;
  compact?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  if (!stimulus) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-[#4F46E5]">
        <span className="w-6 h-6 rounded-lg neu-well-indigo flex items-center justify-center shrink-0">
          <BookOpen className="w-3.5 h-3.5" />
        </span>
        <span>Stimulus Bacaan &amp; Data</span>
      </div>

      <h3 className="text-base font-bold text-[#1E1B4B] leading-snug">
        {stimulus.title}
      </h3>

      {stimulus.imageUrl && !imgError && (
        <div className="rounded-xl neu-surface-sm overflow-hidden">
          <img
            src={stimulus.imageUrl}
            alt={stimulus.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full object-contain bg-white ${
              compact ? 'max-h-48' : 'max-h-72'
            }`}
          />
        </div>
      )}

      {stimulus.imageUrl && imgError && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
          <ImageIcon className="w-6 h-6 text-slate-400" />
          <span>Ilustrasi: {stimulus.title}</span>
        </div>
      )}

      {stimulus.readingText && (
        <div className="text-[15px] leading-relaxed text-slate-800 space-y-3 whitespace-pre-line">
          {stimulus.readingText}
        </div>
      )}

      {stimulus.tableData && stimulus.tableData.headers?.length > 0 && (
        <div className="overflow-x-auto rounded-xl neu-surface-sm">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1E3A8A] to-[#4F46E5] text-white">
                {stimulus.tableData.headers.map((h, i) => (
                  <th key={i} className="px-3.5 py-2.5 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {stimulus.tableData.rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-indigo-50/40' : 'bg-white'}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-3.5 py-2 text-slate-700 ${
                        /^\d+([.,]\d+)?$/.test(cell.trim()) ? 'font-mono-tabular' : ''
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stimulus.chartData && stimulus.chartData.labels?.length > 0 && (
        <div className="rounded-xl neu-surface-sm p-4">
          <div className="text-xs font-bold text-[#1E1B4B] mb-3">
            {stimulus.chartData.title}
          </div>
          <StimulusChartSvg chart={stimulus.chartData} />
        </div>
      )}

      {stimulus.diagramSvg && (
        <div
          className="rounded-lg border border-slate-200 bg-white p-3 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: stimulus.diagramSvg }}
        />
      )}
    </div>
  );
}

function StimulusChartSvg({ chart }: { chart: StimulusChartData }) {
  const maxVal = Math.max(10, ...chart.values);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[11px] font-mono-tabular text-slate-500 py-1 pr-1 text-right min-w-[28px]">
          {[...yTicks].reverse().map((v, idx) => (
            <span key={idx}>{v}</span>
          ))}
        </div>
        <div className="flex-1 flex items-end gap-3 h-40 border-l border-b border-slate-300 px-3 pt-4 pb-0 relative">
          {chart.labels.map((label, idx) => {
            const val = chart.values[idx] ?? 0;
            const pct = Math.max(4, Math.min(100, (val / maxVal) * 100));
            return (
              <div key={label} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[11px] font-mono-tabular font-bold text-[#1E1B4B] mb-1">
                  {val}
                </span>
                <div
                  className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-[#4F46E5] via-[#3B82F6] to-[#38BDF8] shadow-sm"
                  style={{ height: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 pl-9 pr-3 pt-1.5">
        {chart.labels.map((label) => (
          <div key={label} className="flex-1 text-center text-xs text-slate-600 font-medium truncate">
            {label}
          </div>
        ))}
      </div>
      {(chart.xLabel || chart.yLabel) && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Sumbu tegak: {chart.yLabel}</span>
          <span>Sumbu datar: {chart.xLabel}</span>
        </div>
      )}
    </div>
  );
}
