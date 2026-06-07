/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { GenericTrendItem, HeatmapItem } from "../types";

interface ChartsProps {
  dayOfWeekTrends: GenericTrendItem[];
  monthlyTrends: GenericTrendItem[];
  yearlyTrends: GenericTrendItem[];
  heatmapData: HeatmapItem[];
  showDuration: boolean; // Show Duration In Hours vs Show View Count
}

export default function Charts({
  dayOfWeekTrends,
  monthlyTrends,
  yearlyTrends,
  heatmapData,
  showDuration
}: ChartsProps) {
  // Convert minutes to hours if requested
  const mapData = (item: GenericTrendItem) => ({
    label: item.label,
    value: showDuration ? Math.round((item.durationMin / 60) * 10) / 10 : item.count,
    metric: showDuration ? "Hours" : "Views"
  });

  const dowData = dayOfWeekTrends.map(mapData);
  const monthlyData = monthlyTrends.map(mapData);
  const yearlyData = yearlyTrends.map(mapData);

  // Warm theme colors for Netflix aesthetics
  const primaryColor = "#ef4444"; // Netflix Crimson
  const hoverColor = "#dc2626"; // Darker Crimson
  const gradientColor = "#fca5a5"; // Light Rose

  // Custom tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div id={`tooltip-${label}`} className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs font-sans">
          <p className="font-semibold text-slate-100 mb-1">{label}</p>
          <p className="text-rose-400">
            {payload[0].value} {payload[0].payload.metric}
          </p>
        </div>
      );
    }
    return null;
  };

  // Build the 24x7 Heatmap coordinates mapping
  const DOW_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  // Find max value in heatmap to compute scale colors
  const maxHeatmapVal = heatmapData.length > 0 
    ? Math.max(...heatmapData.map(h => showDuration ? h.durationMin : h.count))
    : 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-sans">
      
      {/* Monthly watching trends */}
      <div id="chart-monthly-trends" className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl print-card">
        <h3 className="text-lg font-medium text-slate-100 mb-2 font-display">
          Monthly Watching History
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Track how your streaming changes throughout the year.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={11}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={primaryColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day of Week watching trends */}
      <div id="chart-dow-trends" className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl print-card">
        <h3 className="text-lg font-medium text-slate-100 mb-2 font-display">
          Active Viewing Days
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Find out which days of the week you log the most couch sessions.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={11}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill={primaryColor} 
                radius={[4, 4, 0, 0]}
              >
                {dowData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.value === Math.max(...dowData.map(d => d.value)) ? primaryColor : "#334155"} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Heatmap */}
      <div id="chart-hourly-heatmap" className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl lg:col-span-2 print-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="text-lg font-medium text-slate-100 mb-1 font-display">
              Viewing Activity Heatmap
            </h3>
            <p className="text-xs text-slate-400">
              Your average routine. Find out if you are a morning streamer or an overnight binge-watcher.
            </p>
          </div>
          <div className="flex gap-1.5 items-center text-xs text-slate-400">
            <span>Fewer</span>
            <span className="w-3 h-3 bg-slate-800 rounded-sm inline-block"></span>
            <span className="w-3 h-3 bg-rose-950 rounded-sm inline-block"></span>
            <span className="w-3 h-3 bg-rose-850 rounded-sm inline-block"></span>
            <span className="w-3 h-3 bg-rose-600 rounded-sm inline-block"></span>
            <span className="w-3 h-3 bg-rose-450 rounded-sm inline-block"></span>
            <span>More</span>
          </div>
        </div>

        {/* 24x7 Custom Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[640px] select-none">
            {/* Headers: Hour of Day */}
            <div className="flex border-b border-slate-800/50 pb-2 mb-2 font-mono text-[10px] text-slate-500">
              <div className="w-12 flex-shrink-0">DOW</div>
              <div className="flex-1 grid grid-cols-24 gap-1 text-center">
                {Array(24).fill(0).map((_, h) => (
                  <div key={h} className="text-[10px]">
                    {h === 0 ? "12a" : h === 12 ? "12p" : h % 12}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows: Sunday to Saturday */}
            <div className="space-y-1.5 font-sans">
              {Array(7).fill(0).map((_, dayOfWeek) => {
                const dayLabel = DOW_LABELS_SHORT[dayOfWeek];
                return (
                  <div key={dayOfWeek} className="flex items-center">
                    {/* Day Name Column */}
                    <div className="w-12 text-xs font-medium text-slate-400 flex-shrink-0">
                      {dayLabel}
                    </div>

                    {/* Hours Cells */}
                    <div className="flex-1 grid grid-cols-24 gap-1">
                      {Array(24).fill(0).map((_, hour) => {
                        // Find matching cell item
                        const item = heatmapData.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour);
                        const score = item ? (showDuration ? item.durationMin : item.count) : 0;
                        const pct = maxHeatmapVal > 0 ? score / maxHeatmapVal : 0;

                        // Compute custom background shade
                        let bgClass = "bg-slate-800 hover:ring-2 hover:ring-rose-500";
                        if (pct > 0.8) bgClass = "bg-rose-500 text-white font-bold hover:ring-2 hover:ring-white";
                        else if (pct > 0.5) bgClass = "bg-rose-600 hover:ring-1 hover:ring-rose-400";
                        else if (pct > 0.25) bgClass = "bg-rose-800 hover:ring-1 hover:ring-rose-500";
                        else if (pct > 0.05) bgClass = "bg-rose-950/80 hover:ring-1 hover:ring-rose-700";

                        const tipText = `${DOW_LABELS_SHORT[dayOfWeek]} ${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "PM" : "AM"}: ${score} ${showDuration ? "mins" : "views"}`;

                        return (
                          <div
                            key={hour}
                            id={`heatmap-cell-${dayOfWeek}-${hour}`}
                            title={tipText}
                            className={`h-5 rounded-sm transition-all duration-200 cursor-pointer ${bgClass}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
