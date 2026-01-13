import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { hourlyPrediction } from '@/data/mockData';

export function HourlyPredictionChart() {
  const getBarColor = (risk: number) => {
    if (risk >= 70) return 'hsl(0, 84%, 60%)';
    if (risk >= 50) return 'hsl(25, 95%, 53%)';
    if (risk >= 30) return 'hsl(45, 93%, 47%)';
    return 'hsl(142, 71%, 45%)';
  };

  return (
    <div className="chart-container">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">24-Hour Risk Prediction</h3>
        <p className="text-sm text-muted-foreground">AI-powered crime probability forecast</p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourlyPrediction} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 28%, 22%)" vertical={false} />
            <XAxis
              dataKey="hour"
              stroke="hsl(215, 20%, 65%)"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 14%)',
                border: '1px solid hsl(215, 28%, 22%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
              formatter={(value: number) => [`${value}%`, 'Risk Level']}
            />
            <Bar dataKey="risk" radius={[4, 4, 0, 0]} maxBarSize={30}>
              {hourlyPrediction.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.risk)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-risk-critical" />
          <span className="text-muted-foreground">High Risk (70%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-risk-high" />
          <span className="text-muted-foreground">Elevated (50-70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-risk-medium" />
          <span className="text-muted-foreground">Moderate (30-50%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-risk-low" />
          <span className="text-muted-foreground">Low (&lt;30%)</span>
        </div>
      </div>
    </div>
  );
}
