import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeakageCategory } from '../types';

interface LeakageChartProps {
  data: LeakageCategory[];
}

export const LeakageChart: React.FC<LeakageChartProps> = ({ data }) => {
  // Sort data by leakage amount desc, handling potential undefined input
  const sortedData = [...(data || [])].sort((a, b) => b.estimatedLeakage - a.estimatedLeakage);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px] bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">Leakage by Category</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" tickFormatter={formatCurrency} stroke="#94a3b8" />
          <YAxis 
            type="category" 
            dataKey="category" 
            width={120} 
            stroke="#94a3b8" 
            fontSize={12}
            tick={{fill: '#94a3b8'}}
          />
          <Tooltip 
            cursor={{fill: 'rgba(255,255,255,0.05)'}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
            itemStyle={{ color: '#10b981' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Leakage']}
          />
          <Bar dataKey="estimatedLeakage" radius={[0, 4, 4, 0]} barSize={24}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};