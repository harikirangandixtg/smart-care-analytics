import type { EChartsCoreOption } from 'echarts/core';
import { VisualizationSpec } from '../../core/models/api.models';

export const PALETTE = {
  ink: '#16202C', muted: '#5B6675', line: '#E3E7EC', grid: '#EEF1F4',
  blue: '#1D5FAD', orange: '#C8661C', grey: '#98A2B0',
  // categorical series colours: 12 distinct (blue/orange first; also differ in lightness)
  series: ['#1D5FAD', '#C8661C', '#3B8E8C', '#6B5CA5', '#7FA7D6', '#98A2B0', '#B07A2E', '#A3426B', '#5E8C3A', '#2F3E56', '#D9A43B', '#E07F8A'],
  sequential: ['#EAF1FA', '#CFE0F3', '#A9C6E8', '#7FA7D6', '#4F82C0', '#1D5FAD', '#123F78'],
};

export const STATUS_COLOURS: Record<string, string> = { Paid: PALETTE.blue, Approved: PALETTE.blue, Denied: PALETTE.orange, Pending: PALETTE.grey, Submitted: '#A9C6E8' };

const base = (): EChartsCoreOption => ({
  color: PALETTE.series,
  textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: PALETTE.ink },
  aria: { enabled: true },
  animationDuration: 400,
});

const axisCommon = {
  axisLine: { lineStyle: { color: PALETTE.line } },
  axisTick: { show: false },
  axisLabel: { color: PALETTE.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: PALETTE.grid } },
};

const fmt = (unit = '') => (v: number) =>
  unit === '%' ? `${v}%` : unit === ' Cr' ? `₹${typeof v === 'number' ? +v.toFixed(2) : v} Cr` : `${typeof v === 'number' ? v.toLocaleString('en-IN') : v}${unit}`;

const unique = <T>(xs: T[]) => [...new Set(xs)];
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

/** Long-format rows -> categories + one series per group (or per series def). */
function pivot(spec: VisualizationSpec) {
  const xKey = spec.xKey!;
  const categories = unique(spec.data.map(r => String(r[xKey])));
  const valueKey = spec.series[0].dataKey;
  if (spec.seriesKey) {
    const groups = unique(spec.data.map(r => String(r[spec.seriesKey!])));
    return {
      categories,
      series: groups.map(g => ({
        name: g,
        values: categories.map(c => {
          const row = spec.data.find(r => String(r[xKey]) === c && String(r[spec.seriesKey!]) === g);
          return row ? num(row[valueKey]) : null;
        }),
      })),
    };
  }
  return {
    categories,
    series: spec.series.map(s => ({ name: s.label, values: spec.data.map(r => num(r[s.dataKey])) })),
  };
}

/** One-row legend under the chart; pages with arrows when the names don't fit, so it never covers the plot. */
const scrollLegend = () => ({
  type: 'scroll', orient: 'horizontal', bottom: 0, left: 'center', width: '92%', icon: 'roundRect', itemWidth: 12, itemHeight: 8, itemGap: 14,
  textStyle: { color: PALETTE.muted, fontSize: 12 }, pageIconSize: 10, pageIconColor: PALETTE.ink, pageIconInactiveColor: PALETTE.line,
  pageTextStyle: { color: PALETTE.muted, fontSize: 11 },
});

function lineOrBar(spec: VisualizationSpec, kind: 'line' | 'bar'): EChartsCoreOption {
  const { categories, series } = pivot(spec);
  const o = spec.options ?? {};
  const horizontal = kind === 'bar' && o.orientation === 'horizontal';
  const multi = series.length > 1;
  const stacked = kind === 'bar' && !!o.stacked;
  const format = fmt(o.unit);

  const catAxis = { type: 'category', data: categories, ...axisCommon, splitLine: { show: false }, ...(horizontal ? { inverse: true, axisLabel: { color: PALETTE.ink, fontSize: 12 } } : {}) };
  const valAxis = { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: format, hideOverlap: true }, scale: kind === 'line', splitNumber: 4 };

  return {
    ...base(),
    tooltip: { trigger: 'axis', axisPointer: { type: kind === 'bar' ? 'shadow' : 'line' }, valueFormatter: format, order: multi && !stacked ? 'valueDesc' : 'seriesAsc', confine: true },
    legend: multi ? scrollLegend() : undefined,
    grid: { left: 12, right: horizontal ? 56 : 24, top: 28, bottom: (multi ? 40 : 12) + (kind === 'line' && categories.length > 16 ? 26 : 0), containLabel: true },
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? catAxis : valAxis,
    dataZoom: kind === 'line' && categories.length > 16 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: multi ? 34 : 0 }] : undefined,
    series: series.map((s, i) => ({
      name: s.name,
      type: kind,
      stack: stacked ? 'total' : undefined,
      color: STATUS_COLOURS[s.name],
      data: kind === 'bar' && o.highlightAbove !== undefined
        ? s.values.map(v => ({ value: v, itemStyle: { color: (v ?? 0) > o.highlightAbove! ? PALETTE.orange : PALETTE.blue } }))
        : s.values,
      smooth: false,
      symbolSize: multi ? 5 : 6,
      lineStyle: { width: multi ? 2 : 2.5 },
      // hovering a line or its legend entry highlights that series and fades the others
      emphasis: multi ? { focus: 'series', lineStyle: { width: 3 } } : undefined,
      blur: multi ? { lineStyle: { opacity: 0.15 }, itemStyle: { opacity: 0.15 } } : undefined,
      connectNulls: kind === 'line',
      areaStyle: kind === 'line' && o.area && !multi ? { opacity: 0.08 } : undefined,
      barMaxWidth: horizontal ? 22 : 36,
      itemStyle: { borderRadius: stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] },
      label: stacked && i === series.length - 1 ? { show: true, position: horizontal ? 'right' : 'top', color: PALETTE.ink, fontWeight: 600, fontSize: 11,
        formatter: (p: { dataIndex: number }) => format(+series.reduce((a, x) => a + (x.values[p.dataIndex] ?? 0), 0).toFixed(2)) }
        : kind === 'bar' && !multi ? { show: true, position: horizontal ? 'right' : 'top', formatter: (p: { value: number }) => format(p.value), color: PALETTE.ink, fontWeight: 600, fontSize: 12 } : undefined,
      markPoint: o.markPeak && !multi && i === 0 ? { symbol: 'pin', symbolSize: 0, data: [{ type: 'max', name: 'Peak' }], label: { show: true, formatter: (p: { value: number }) => `Peak ${format(p.value)}`, backgroundColor: PALETTE.ink, color: '#fff', padding: [4, 8], borderRadius: 4, offset: [0, -14], fontSize: 11, fontWeight: 600 } } : undefined,
      markLine: o.target !== undefined && i === 0 ? { symbol: 'none', silent: true, lineStyle: { color: PALETTE.ink, type: 'dashed' }, label: { formatter: `Target ${format(o.target)}`, color: PALETTE.ink, fontWeight: 600, position: horizontal ? 'start' : 'insideEndTop' }, data: [horizontal ? { xAxis: o.target } : { yAxis: o.target }] } : undefined,
    })),
  };
}

function pie(spec: VisualizationSpec): EChartsCoreOption {
  const key = spec.series[0].dataKey;
  return {
    ...base(),
    tooltip: { trigger: 'item', valueFormatter: fmt(spec.options?.unit) },
    legend: scrollLegend(),
    series: [{ type: 'pie', radius: spec.options?.donut === false ? ['0%', '70%'] : ['48%', '72%'], center: ['50%', '45%'], itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: (p: { name: string; percent: number }) => `${p.name}\n${p.percent.toFixed(1)}%`, color: PALETTE.ink },
      data: spec.data.map(r => { const name = String(r[spec.xKey!]); return { name, value: num(r[key]), itemStyle: STATUS_COLOURS[name] ? { color: STATUS_COLOURS[name] } : undefined }; }) }],
  };
}

function heatmap(spec: VisualizationSpec): EChartsCoreOption {
  const xs = unique(spec.data.map(r => String(r[spec.xKey!])));
  const ys = unique(spec.data.map(r => String(r[spec.seriesKey!])));
  const key = spec.series[0].dataKey;
  const values = spec.data.map(r => num(r[key]));
  return {
    ...base(),
    tooltip: { position: 'top', formatter: (p: { value: [number, number, number] }) => `${ys[p.value[1]]} · ${xs[p.value[0]]}<br/><b>${p.value[2].toLocaleString('en-IN')}</b> ${spec.series[0].label.toLowerCase()}` },
    grid: { left: 12, right: 12, top: 8, bottom: 52, containLabel: true },
    xAxis: { type: 'category', data: xs, ...axisCommon, splitArea: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: ys, inverse: true, ...axisCommon, axisLabel: { color: PALETTE.ink, fontSize: 12 }, splitLine: { show: false } },
    visualMap: { min: Math.min(...values), max: Math.max(...values), orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 140,
      text: ['More', 'Fewer'], textStyle: { color: PALETTE.muted, fontSize: 11 }, inRange: { color: PALETTE.sequential }, calculable: false },
    series: [{ type: 'heatmap', data: spec.data.map(r => [xs.indexOf(String(r[spec.xKey!])), ys.indexOf(String(r[spec.seriesKey!])), num(r[key])]),
      label: { show: true, fontSize: 11 }, itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 } }],
  };
}

function sankey(spec: VisualizationSpec): EChartsCoreOption {
  const names = unique(spec.data.flatMap(r => [String(r['source']), String(r['target'])]));
  return {
    ...base(),
    tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v.toLocaleString('en-IN')} claims` },
    series: [{
      type: 'sankey', left: 150, right: 110, top: 8, bottom: 8, nodeWidth: 14, nodeGap: 12, draggable: false,
      layoutIterations: 0, // keep the API's order: payers top-down, Paid / Denied / Pending
      emphasis: { focus: 'adjacency' },
      data: names.map(n => ({
        name: n,
        itemStyle: { color: STATUS_COLOURS[n] ?? PALETTE.ink, borderWidth: 0 },
        label: STATUS_COLOURS[n] ? undefined : { position: 'left' },
      })),
      links: spec.data.map(r => ({ source: r['source'], target: r['target'], value: num(r['value']) })),
      lineStyle: { color: 'target', opacity: 0.28, curveness: 0.5 },
      label: { color: PALETTE.ink, fontSize: 12, formatter: (p: { name: string; value: number }) => STATUS_COLOURS[p.name] ? `{b|${p.name}}\n${p.value.toLocaleString('en-IN')}` : p.name, rich: { b: { fontWeight: 600 } } },
    }],
  };
}

function funnel(spec: VisualizationSpec): EChartsCoreOption {
  const key = spec.series[0].dataKey;
  return {
    ...base(),
    tooltip: { trigger: 'item' },
    series: [{ type: 'funnel', left: '10%', width: '80%', sort: 'descending', gap: 2, label: { position: 'inside', color: '#fff', fontWeight: 600 },
      data: spec.data.map(r => ({ name: String(r[spec.xKey!]), value: num(r[key]) })) }],
  };
}

function gauge(spec: VisualizationSpec): EChartsCoreOption {
  const o = spec.options ?? {};
  const max = o.max ?? 100, target = o.target ?? max;
  const value = num(spec.data[0]?.[spec.series[0].dataKey]);
  return {
    ...base(),
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max, radius: '95%', center: ['50%', '60%'],
      progress: { show: true, width: 18, itemStyle: { color: value > target ? PALETTE.orange : PALETTE.blue } },
      axisLine: { lineStyle: { width: 18, color: [[target / max, '#DCE8F6'], [1, '#FBEBDD']] } },
      pointer: { show: false }, splitLine: { show: false }, axisTick: { show: false },
      axisLabel: { distance: 26, color: PALETTE.muted, fontSize: 11, formatter: (v: number) => (v === 0 || v === max || v === target ? `${v}${o.unit ?? ''}` : '') },
      splitNumber: max,
      title: { show: true, offsetCenter: [0, '32%'], color: PALETTE.muted, fontSize: 12 },
      detail: { valueAnimation: true, offsetCenter: [0, '0%'], fontSize: 36, fontWeight: 700, color: PALETTE.ink, formatter: `{value}${o.unit ?? ''}` },
      data: [{ value, name: `Target ${target}${o.unit ?? ''}` }],
    }],
  };
}

function boxplot(spec: VisualizationSpec): EChartsCoreOption {
  const cats = spec.data.map(r => String(r[spec.xKey!]));
  const unit = spec.options?.unit ?? '';
  return {
    ...base(),
    tooltip: { trigger: 'item', formatter: (p: { name: string; value: number[] }) => {
      const [, min, q1, med, q3, max] = p.value;
      return `<b>${p.name}</b><br/>Median ${med}${unit}<br/>Middle 50%: ${q1}–${q3}${unit}<br/>Range: ${min}–${max}${unit}`;
    } },
    grid: { left: 12, right: 24, top: 8, bottom: 12, containLabel: true },
    xAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${v}${unit}` } },
    yAxis: { type: 'category', data: cats, inverse: true, ...axisCommon, axisLabel: { color: PALETTE.ink, fontSize: 12 }, splitLine: { show: false } },
    series: [{ type: 'boxplot', boxWidth: [10, 22], itemStyle: { color: 'rgba(29,95,173,0.15)', borderColor: PALETTE.blue, borderWidth: 1.5 },
      data: spec.data.map(r => [num(r['min']), num(r['q1']), num(r['median']), num(r['q3']), num(r['max'])]) }],
  };
}

export function toEchartsOption(spec: VisualizationSpec): EChartsCoreOption {
  switch (spec.chartType) {
    case 'line': return lineOrBar(spec, 'line');
    case 'bar': return lineOrBar(spec, 'bar');
    case 'pie': return pie(spec);
    case 'heatmap': return heatmap(spec);
    case 'sankey': return sankey(spec);
    case 'funnel': return funnel(spec);
    case 'gauge': return gauge(spec);
    case 'boxplot': return boxplot(spec);
    default: return base();
  }
}

/** Table columns for any spec: category, optional series key, then each series value. */
export function specColumns(spec: VisualizationSpec): { key: string; label: string; numeric: boolean }[] {
  const cols: { key: string; label: string; numeric: boolean }[] = [];
  const title = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  if (spec.chartType === 'sankey') return [{ key: 'source', label: 'From', numeric: false }, { key: 'target', label: 'To', numeric: false }, { key: 'value', label: spec.series[0].label, numeric: true }];
  if (spec.chartType === 'boxplot') return [{ key: spec.xKey!, label: title(spec.xKey!), numeric: false }, ...['min', 'q1', 'median', 'q3', 'max'].map(k => ({ key: k, label: k === 'q1' ? 'Q1' : k === 'q3' ? 'Q3' : title(k), numeric: true }))];
  if (spec.xKey) cols.push({ key: spec.xKey, label: title(spec.xKey), numeric: false });
  if (spec.seriesKey) cols.push({ key: spec.seriesKey, label: title(spec.seriesKey), numeric: false });
  for (const s of spec.series) cols.push({ key: s.dataKey, label: s.label, numeric: true });
  return cols;
}

const SUPPORTED: string[] = ['line', 'bar', 'pie', 'heatmap', 'sankey', 'funnel', 'gauge', 'boxplot', 'table'];

/** Frontend spec §14: validate chartType and field names before rendering. Returns a reason when the chart can't be drawn. */
export function specProblem(spec: VisualizationSpec | null | undefined): string | null {
  if (!spec) return 'No chart was returned.';
  if (!Array.isArray(spec.data) || spec.data.length === 0) return 'No data matched these filters.';
  if (!SUPPORTED.includes(spec.chartType)) return `Chart type “${spec.chartType}” isn't supported; showing the table instead.`;
  if (spec.chartType === 'sankey') return spec.data.every(r => 'source' in r && 'target' in r && 'value' in r) ? null : 'The flow chart data is incomplete; showing the table instead.';
  if (spec.chartType === 'gauge' || spec.chartType === 'table') return null;
  const keys = new Set(Object.keys(spec.data[0]));
  if (spec.xKey && !keys.has(spec.xKey)) return `Field “${spec.xKey}” is missing from the data; showing the table instead.`;
  if (spec.seriesKey && !keys.has(spec.seriesKey)) return `Field “${spec.seriesKey}” is missing from the data; showing the table instead.`;
  const missing = (spec.series ?? []).filter(x => !keys.has(x.dataKey) && !(spec.chartType === 'boxplot'));
  if (missing.length) return `Field “${missing[0].dataKey}” is missing from the data; showing the table instead.`;
  return null;
}
