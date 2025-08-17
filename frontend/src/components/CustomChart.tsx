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
import { MetricOption } from './MetricSelector';

interface CustomChartProps {
  data: any[];
  metric: MetricOption;
  onRemove: () => void;
  height?: number;
}

export const CustomChart: React.FC<CustomChartProps> = ({
  data,
  metric,
  onRemove,
  height = 300
}) => {
  // Extract values from the complex data structure
  const processedData = data.map(record => {
    let value = null;
    
    // Handle percentage metrics (already calculated)
    if (metric.dataKey.includes('Percentage')) {
      value = record[metric.dataKey];
    }
    // Handle raw Salesforce limit data
    else if (record.limitsData && record.limitsData[metric.dataKey]) {
      const limitData = record.limitsData[metric.dataKey];
      if (limitData.Max && limitData.Remaining !== undefined) {
        const used = limitData.Max - limitData.Remaining;
        // Calculate percentage for limits with Max/Remaining structure
        if (metric.unit === '%') {
          value = limitData.Max > 0 ? (used / limitData.Max) * 100 : 0;
        } else {
          value = used; // Absolute values
        }
      }
    }
    
    return {
      ...record,
      [metric.key]: value
    };
  });

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
    if (value === null || value === undefined) {
      return ['No data', metric.label];
    }
    
    if (metric.unit === '%') {
      return [`${value.toFixed(2)}%`, metric.label];
    }
    
    // Format large numbers
    if (value >= 1000000) {
      return [`${(value / 1000000).toFixed(1)}M ${metric.unit}`, metric.label];
    } else if (value >= 1000) {
      return [`${(value / 1000).toFixed(1)}K ${metric.unit}`, metric.label];
    }
    
    return [`${value.toLocaleString()} ${metric.unit}`, metric.label];
  };

  // Calculate domain for Y-axis
  const values = processedData.map(d => d[metric.key]).filter(v => v !== null);
  const maxValue = Math.max(...values);
  const domain = metric.unit === '%' ? [0, 100] : ['auto', 'auto'];

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg relative">
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove chart"
      >
        ✕
      </button>

      {/* Chart header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{metric.label}</h3>
        <p className="text-sm text-gray-600">{metric.description}</p>
        <span className="inline-block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1">
          {metric.category}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            domain={domain}
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
          
          {/* Warning reference lines for percentage metrics */}
          {metric.unit === '%' && maxValue > 50 && (
            <>
              <ReferenceLine 
                y={80} 
                stroke="#f59e0b" 
                strokeDasharray="5 5"
                label={{ value: "Warning (80%)", position: "left" }}
              />
              <ReferenceLine 
                y={95} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                label={{ value: "Critical (95%)", position: "left" }}
              />
            </>
          )}
          
          <Line 
            type="monotone" 
            dataKey={metric.key}
            stroke={metric.color} 
            strokeWidth={2}
            dot={{ fill: metric.color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: metric.color, strokeWidth: 2 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Data summary */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Data points: {values.length}</span>
          {values.length > 0 && (
            <span>
              Latest: {formatTooltipValue(values[values.length - 1])[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};