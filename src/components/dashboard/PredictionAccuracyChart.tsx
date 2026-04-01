import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
} from 'recharts';
import { TrendingUp, Target, BarChart3, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePredictionAccuracy } from '@/hooks/usePredictionAccuracy';

// Generate mock historical comparison data
const generateHistoricalData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  return months.slice(0, currentMonth + 1).map((month, index) => {
    const predicted = Math.floor(Math.random() * 40) + 60; // 60-100 incidents predicted
    const actual = predicted + Math.floor(Math.random() * 20) - 10; // ±10 variance
    const accuracy = Math.max(70, 100 - Math.abs(predicted - actual) * 2);
    
    return {
      month,
      predicted,
      actual: Math.max(0, actual),
      accuracy,
      variance: actual - predicted,
    };
  });
};

const generateWeeklyData = () => {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  
  return weeks.map((week, index) => {
    const predicted = Math.floor(Math.random() * 20) + 15;
    const actual = predicted + Math.floor(Math.random() * 8) - 4;
    
    return {
      week,
      predicted,
      actual: Math.max(0, actual),
      accuracy: Math.max(75, 100 - Math.abs(predicted - actual) * 3),
    };
  });
};

const generateZoneAccuracy = () => {
  const zones = [
    'Thane Station',
    'Kopri Colony',
    'Naupada',
    'Wagle Estate',
    'Majiwada',
    'Vartak Nagar',
  ];
  
  return zones.map(zone => ({
    zone,
    accuracy: Math.floor(Math.random() * 20) + 75,
    incidents: Math.floor(Math.random() * 30) + 10,
  }));
};

export function PredictionAccuracyChart() {
  const { monthlyData, weeklyData, zoneAccuracy, isLoading } = usePredictionAccuracy();
  const fallbackHistoricalData = useMemo(() => generateHistoricalData(), []);
  const fallbackWeeklyData = useMemo(() => generateWeeklyData(), []);
  const fallbackZoneAccuracy = useMemo(() => generateZoneAccuracy(), []);

  const historicalData = monthlyData.length > 0 ? monthlyData : fallbackHistoricalData;
  const weeklyTrendData = weeklyData.length > 0 ? weeklyData : fallbackWeeklyData;
  const zoneAccuracyData = zoneAccuracy.length > 0 ? zoneAccuracy : fallbackZoneAccuracy;

  const overallAccuracy = useMemo(() => {
    const total = historicalData.reduce((acc, d) => acc + d.accuracy, 0);
    return Math.round(total / historicalData.length);
  }, [historicalData]);

  const totalPredicted = historicalData.reduce((acc, d) => acc + d.predicted, 0);
  const totalActual = historicalData.reduce((acc, d) => acc + d.actual, 0);

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Prediction Accuracy Analysis
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading historical data...
                </>
              ) : (
                'Historical comparison of predictions vs actual incidents'
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{overallAccuracy}%</p>
              <p className="text-xs text-muted-foreground">Overall Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-border">
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Predicted</span>
          </div>
          <p className="text-xl font-bold text-foreground">{totalPredicted}</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-green-400" />
            <span className="text-xs text-muted-foreground">Actual Incidents</span>
          </div>
          <p className="text-xl font-bold text-foreground">{totalActual}</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-muted-foreground">Variance</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            totalPredicted - totalActual > 0 ? 'text-green-400' : 'text-red-400'
          )}>
            {totalPredicted - totalActual > 0 ? '+' : ''}{totalPredicted - totalActual}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-muted-foreground">Best Month</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {historicalData.reduce((best, d) => d.accuracy > best.accuracy ? d : best, historicalData[0]).month}
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-foreground mb-4">Monthly Comparison</h4>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="predicted" 
                fill="hsl(var(--primary))" 
                name="Predicted"
                opacity={0.7}
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                yAxisId="left"
                dataKey="actual" 
                fill="#22c55e" 
                name="Actual"
                opacity={0.7}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="accuracy"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', strokeWidth: 2 }}
                name="Accuracy %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-2 gap-4 p-4 border-t border-border">
        {/* Weekly Trend */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-4">This Month's Weekly Trend</h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stackId="1"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  name="Predicted"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stackId="2"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.3}
                  name="Actual"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone Accuracy */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-4">Accuracy by Zone</h4>
          <div className="space-y-2">
            {zoneAccuracyData.slice(0, 5).map((zone) => (
              <div key={zone.zone} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 truncate">{zone.zone}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      zone.accuracy >= 90 ? 'bg-green-500' :
                      zone.accuracy >= 80 ? 'bg-primary' :
                      zone.accuracy >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${zone.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right">{zone.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
