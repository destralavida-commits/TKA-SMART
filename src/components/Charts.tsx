import React, { useState } from 'react';

export interface SimpleBarItem {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_BAR_GRADIENTS = [
  'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)',
  'linear-gradient(180deg, #818CF8 0%, #4F46E5 100%)',
  'linear-gradient(180deg, #34D399 0%, #059669 100%)',
  'linear-gradient(180deg, #FBBF24 0%, #D97706 100%)',
  'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)',
];

export function SimpleBarChart({
  data,
  height = 220,
  unit = '',
  maxOverride,
}: {
  data: SimpleBarItem[];
  height?: number;
  unit?: string;
  maxOverride?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxVal = maxOverride ?? Math.max(10, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-slate-400">
        Belum ada data grafik.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className="flex items-end gap-3 pt-6 pb-2 px-3 neu-inset"
        style={{ height }}
      >
        {data.map((item, idx) => {
          const pct = Math.max(6, Math.min(100, (item.value / maxVal) * 100));
          const bgStyle = item.color
            ? `linear-gradient(180deg, ${item.color}dd 0%, ${item.color} 100%)`
            : DEFAULT_BAR_GRADIENTS[idx % DEFAULT_BAR_GRADIENTS.length];
          return (
            <div
              key={item.label}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              <div
                className={`text-xs font-mono-tabular font-bold mb-1.5 transition-opacity ${
                  hovered === idx ? 'text-[#1E1B4B]' : 'text-slate-600'
                }`}
              >
                {item.value}
                {unit}
              </div>
              <div className="w-full max-w-[46px] flex-1 flex items-end justify-center">
                <div
                  className="w-full rounded-t-xl transition-all duration-200 shadow-[0_4px_12px_rgba(79,70,229,0.22)]"
                  style={{
                    height: `${pct}%`,
                    background: bgStyle,
                    opacity: hovered === null || hovered === idx ? 1 : 0.72,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-3 pt-2.5 px-3">
        {data.map((item) => (
          <div
            key={item.label}
            className="flex-1 text-center text-xs text-slate-600 font-semibold truncate"
            title={item.label}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface GroupedBarItem {
  label: string;
  valueA: number;
  valueB: number;
}

export function GroupedComparisonChart({
  data,
  labelA,
  labelB,
  unit = '',
}: {
  data: GroupedBarItem[];
  labelA: string;
  labelB: string;
  unit?: string;
}) {
  const maxVal = Math.max(100, ...data.flatMap((d) => [d.valueA, d.valueB]));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-slate-400">
        Belum ada data perbandingan.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-6 mb-4 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-[#4F46E5] to-[#2563EB] inline-block shadow-xs" />
          <span>{labelA}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-[#06B6D4] to-[#10B981] inline-block shadow-xs" />
          <span>{labelB}</span>
        </div>
      </div>

      <div className="flex items-end gap-4 h-52 pt-6 pb-2 px-3 neu-inset">
        {data.map((d) => {
          const pctA = Math.max(4, Math.min(100, (d.valueA / maxVal) * 100));
          const pctB = Math.max(4, Math.min(100, (d.valueB / maxVal) * 100));
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="flex items-end gap-2 w-full max-w-[76px] h-full justify-center">
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[11px] font-mono-tabular font-bold text-[#4338CA] mb-1">
                    {d.valueA}
                    {unit}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#4338CA] to-[#3B82F6] shadow-sm"
                    style={{ height: `${pctA}%` }}
                  />
                </div>
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[11px] font-mono-tabular font-bold text-teal-700 mb-1">
                    {d.valueB}
                    {unit}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#0D9488] to-[#06B6D4] shadow-sm"
                    style={{ height: `${pctB}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-4 pt-2.5 px-3">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-center text-xs text-slate-600 font-semibold truncate"
            title={d.label}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function SimpleDonutChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center rounded-full neu-surface-sm p-1">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth="18"
          />
          {total > 0 &&
            slices.map((slice) => {
              const frac = slice.value / total;
              const dash = frac * circumference;
              const offset = cumulativeOffset;
              cumulativeOffset += dash;
              if (slice.value <= 0) return null;
              return (
                <circle
                  key={slice.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-lg font-extrabold font-mono-tabular text-[#1E1B4B]">
            {centerValue}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">{centerLabel}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <div key={slice.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm shrink-0 shadow-xs"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-slate-700 font-medium truncate">{slice.label}</span>
              </div>
              <div className="font-mono-tabular text-xs font-bold text-[#1E1B4B] shrink-0 ml-3">
                {slice.value} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
