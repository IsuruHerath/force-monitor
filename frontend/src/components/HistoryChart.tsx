import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface HistoryChartProps {
  data: any[];
  title: string;
  dataKey: string;
  color: string;
  thresholds?: {
    warning: number;
    critical: number;
  };
  height?: number;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({
  data,
  title,
  dataKey,
  color,
  thresholds,
  height = 300
}) => {
  const formatDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipLabel = (label: string) => {
    const date = new Date(label);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTooltipValue = (value: number) => {
    if (dataKey.includes('Percentage')) {
      return [`${value.toFixed(1)}%`, title];
    }
    return [value.toLocaleString(), title];
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="collectedAt" 
            tickFormatter={formatDate}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            domain={dataKey.includes('Percentage') ? [0, 100] : ['auto', 'auto']}
          />
          <Tooltip 
            labelFormatter={formatTooltipLabel}
            formatter={formatTooltipValue}
            contentStyle={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px'
            }}
          />
          <Legend />
          
          {/* Warning and Critical Reference Lines for Percentage Charts */}
          {thresholds && dataKey.includes('Percentage') && (
            <>
              <ReferenceLine 
                y={thresholds.warning} 
                stroke="#f59e0b" 
                strokeDasharray="5 5"
                label={{ value: "Warning", position: "left" }}
              />
              <ReferenceLine 
                y={thresholds.critical} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                label={{ value: "Critical", position: "left" }}
              />
            </>
          )}
          
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};