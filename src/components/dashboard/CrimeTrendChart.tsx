import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { crimeTrendData } from '@/data/mockData';

export function CrimeTrendChart() {
  return (
    <div className="chart-container">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Crime Trends</h3>
        <p className="text-sm text-muted-foreground">6-month historical analysis</p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={crimeTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTheft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAssault" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorBurglary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCyber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 28%, 22%)" />
            <XAxis
              dataKey="month"
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 14%)',
                border: '1px solid hsl(215, 28%, 22%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span style={{ color: 'hsl(215, 20%, 65%)' }}>{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="theft"
              name="Theft"
              stroke="hsl(0, 84%, 60%)"
              fillOpacity={1}
              fill="url(#colorTheft)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="assault"
              name="Assault"
              stroke="hsl(25, 95%, 53%)"
              fillOpacity={1}
              fill="url(#colorAssault)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="burglary"
              name="Burglary"
              stroke="hsl(45, 93%, 47%)"
              fillOpacity={1}
              fill="url(#colorBurglary)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="cyber"
              name="Cyber Crime"
              stroke="hsl(217, 91%, 60%)"
              fillOpacity={1}
              fill="url(#colorCyber)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
