import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HourlyPredictionChart } from '@/components/dashboard/HourlyPredictionChart';
import { CrimeTrendChart } from '@/components/dashboard/CrimeTrendChart';
import { PredictionAccuracyChart } from '@/components/dashboard/PredictionAccuracyChart';
import { useCrimePrediction } from '@/hooks/useCrimePrediction';
import { Brain, TrendingUp, Target, AlertTriangle, Clock, MapPin, Database, Cpu, Loader2, Zap, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function CrimePrediction() {
  const { 
    isLoading, 
    isLoadingData, 
    prediction, 
    runPrediction, 
    dataStats 
  } = useCrimePrediction();
  const { toast } = useToast();
  
  const [predictionType, setPredictionType] = useState<'hotspot' | 'trend' | 'risk' | 'patrol'>('hotspot');

  const handleRunPrediction = () => {
    runPrediction(predictionType);
  };

  const hotspots = prediction?.prediction?.hotspots || [];
  const modelAccuracy = prediction?.prediction?.modelAccuracy || 87.5;
  const preventionRate = prediction?.prediction?.preventionRate || 92;
  const highRiskCount = prediction?.prediction?.highRiskCount || hotspots.filter(h => h.riskScore >= 70).length;
  const predictedTotal = hotspots.reduce((sum, h) => sum + (h.predictedCrimes || 0), 0) || 28;

  const handleDownloadReport = () => {
    if (!prediction) {
      toast({
        title: 'Run prediction first',
        description: 'Generate a prediction result before downloading a report.',
      });
      return;
    }

    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (predictionType === 'hotspot') {
      headers = ['Zone', 'Risk Score', 'Predicted Incidents', 'Peak Hours', 'Likely Crime', 'Crime Probability (%)', 'Confidence (%)', 'Crime Types', 'Reasoning'];
      rows = (prediction.prediction.hotspots ?? []).map((hotspot) => [
        hotspot.zone,
        hotspot.riskScore,
        hotspot.predictedCrimes,
        hotspot.peakHours,
        hotspot.topCrimeType ?? '',
        hotspot.topCrimeProbability ?? '',
        hotspot.confidence ?? '',
        hotspot.crimeTypes.join(' | '),
        hotspot.reasoning ?? '',
      ]);
    } else if (predictionType === 'trend') {
      headers = ['Crime Type', 'Direction', 'Change (%)', 'Prediction'];
      rows = (prediction.prediction.trends ?? []).map((trend) => [
        trend.crimeType,
        trend.direction,
        trend.percentChange,
        trend.prediction,
      ]);
    } else if (predictionType === 'risk') {
      headers = ['Area', 'Risk Score', 'Risk Factors', 'Recommendation'];
      rows = (prediction.prediction.riskZones ?? []).map((zone) => [
        zone.area,
        zone.riskScore,
        zone.factors.join(' | '),
        zone.recommendation,
      ]);
    } else if (predictionType === 'patrol') {
      headers = ['Priority', 'Area', 'Suggested Time', 'Officers Needed', 'Crime Types'];
      rows = (prediction.prediction.routes ?? []).map((route) => [
        route.priority,
        route.area,
        route.suggestedTime,
        route.officersNeeded,
        route.crimeTypes.join(' | '),
      ]);
    }

    if (rows.length === 0) {
      toast({
        title: 'No report data',
        description: 'No records available for this prediction type yet.',
        variant: 'destructive',
      });
      return;
    }

    const timestamp = new Date(prediction.timestamp || new Date().toISOString())
      .toISOString()
      .replace(/[:.]/g, '-');
    const filename = `lokrakshak-${predictionType}-report-${timestamp}.csv`;

    downloadCsv(filename, headers, rows);
    toast({
      title: 'Report downloaded',
      description: `Saved ${rows.length} record${rows.length > 1 ? 's' : ''} as CSV.`,
    });
  };

  return (
    <DashboardLayout
      title="Crime Prediction"
      subtitle="Random Forest-based crime forecasting using real FIR data"
    >
      <div className="space-y-6">
        {/* Data & Algorithm Info */}
        <div className="card-command p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Crime Dataset</h3>
                {isLoadingData ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading data...
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {dataStats.totalRecords.toLocaleString()} records • {dataStats.uniqueAreas} areas • {dataStats.crimeTypes} crime types
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={predictionType} onValueChange={(v) => setPredictionType(v as typeof predictionType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Prediction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotspot">Hotspot Detection</SelectItem>
                  <SelectItem value="trend">Trend Analysis</SelectItem>
                  <SelectItem value="risk">Risk Scoring</SelectItem>
                  <SelectItem value="patrol">Patrol Routes</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={handleDownloadReport}
                disabled={!prediction || isLoading}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
              
              <Button 
                onClick={handleRunPrediction} 
                disabled={isLoading || isLoadingData}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Run Prediction
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Algorithm Info Panel */}
        {prediction?.algorithm && (
          <div className="card-command p-4 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-2">{prediction.algorithm.name}</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {prediction.algorithm.components.map((component, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {component}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Model: {prediction.algorithm.model} • Analyzed {prediction.algorithm.dataPoints} data points
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Model Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{modelAccuracy}%</p>
                <p className="text-sm text-muted-foreground">Model Accuracy</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-high/20">
                <TrendingUp className="h-6 w-6 text-risk-high" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{predictedTotal}</p>
                <p className="text-sm text-muted-foreground">Predicted (24h)</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-critical/20">
                <AlertTriangle className="h-6 w-6 text-risk-critical" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{highRiskCount || 4}</p>
                <p className="text-sm text-muted-foreground">High-Risk Zones</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-safe/20">
                <Target className="h-6 w-6 text-risk-safe" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{preventionRate}%</p>
                <p className="text-sm text-muted-foreground">Prevention Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HourlyPredictionChart />
          <CrimeTrendChart />
        </div>

        <PredictionAccuracyChart />

        {/* Predicted Hotspots */}
        <div className="card-command">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {predictionType === 'hotspot' && 'Predicted Hotspots (Next 24 Hours)'}
              {predictionType === 'trend' && 'Crime Trends Analysis'}
              {predictionType === 'risk' && 'Risk Zone Assessment'}
              {predictionType === 'patrol' && 'Suggested Patrol Routes'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {prediction 
                ? `AI analysis completed at ${new Date(prediction.timestamp).toLocaleString()}`
                : 'Run prediction to see AI-generated insights'
              }
            </p>
          </div>
          
          <div className="p-4">
            {/* Hotspots Display */}
            {predictionType === 'hotspot' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(hotspots.length > 0 ? hotspots : getDefaultHotspots()).map((hotspot, index) => {
                  const getRiskClass = (score: number) => {
                    if (score >= 70) return 'border-l-risk-critical bg-risk-critical/5';
                    if (score >= 50) return 'border-l-risk-high bg-risk-high/5';
                    return 'border-l-risk-medium bg-risk-medium/5';
                  };

                  const getRiskBadge = (score: number) => {
                    if (score >= 70) return 'badge-critical';
                    if (score >= 50) return 'badge-high';
                    return 'badge-medium';
                  };

                  return (
                    <div
                      key={index}
                      className={cn(
                        'p-4 rounded-lg border-l-4 border border-border animate-fade-in',
                        getRiskClass(hotspot.riskScore)
                      )}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-medium text-foreground">{hotspot.zone}</h4>
                        </div>
                        <span className={getRiskBadge(hotspot.riskScore)}>
                          Score: {hotspot.riskScore}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{hotspot.predictedCrimes} predicted incidents</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Peak hours: {hotspot.peakHours}</span>
                        </div>
                        {hotspot.topCrimeType && hotspot.topCrimeProbability ? (
                          <div className="text-xs text-muted-foreground">
                            Likely crime: {hotspot.topCrimeType} ({hotspot.topCrimeProbability}%)
                          </div>
                        ) : null}
                        {hotspot.confidence && (
                          <div className="text-xs text-muted-foreground">
                            Confidence: {hotspot.confidence}%
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {hotspot.crimeTypes.map((type) => (
                          <span
                            key={type}
                            className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                      {hotspot.reasoning && (
                        <p className="mt-2 text-xs text-muted-foreground italic">
                          {hotspot.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Trends Display */}
            {predictionType === 'trend' && prediction?.prediction?.trends && (
              <div className="space-y-4">
                {prediction.prediction.trends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <h4 className="font-medium">{trend.crimeType}</h4>
                      <p className="text-sm text-muted-foreground">{trend.prediction}</p>
                    </div>
                    <Badge variant={trend.direction === 'increasing' ? 'destructive' : trend.direction === 'decreasing' ? 'default' : 'secondary'}>
                      {trend.direction} {trend.percentChange > 0 ? `+${trend.percentChange}%` : `${trend.percentChange}%`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Risk Zones Display */}
            {predictionType === 'risk' && prediction?.prediction?.riskZones && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prediction.prediction.riskZones.map((zone, index) => (
                  <div key={index} className="p-4 rounded-lg border border-border">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{zone.area}</h4>
                      <Badge variant={zone.riskScore >= 70 ? 'destructive' : zone.riskScore >= 50 ? 'default' : 'secondary'}>
                        {zone.riskScore}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {zone.factors.map((factor, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{zone.recommendation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Patrol Routes Display */}
            {predictionType === 'patrol' && prediction?.prediction?.routes && (
              <div className="space-y-4">
                {prediction.prediction.routes.map((route, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                      {route.priority}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{route.area}</h4>
                      <p className="text-sm text-muted-foreground">
                        {route.suggestedTime} • {route.officersNeeded} officers needed
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.crimeTypes.map((type, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{type}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Results Message */}
            {!prediction && predictionType !== 'hotspot' && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Run Prediction" to analyze crime data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function escapeCsvValue(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  const csvContent = [headerLine, ...bodyLines].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Default hotspots when no prediction has been run
function getDefaultHotspots() {
  return [
    {
      zone: 'AMBERNATH Station Area',
      riskScore: 78,
      predictedCrimes: 12,
      crimeTypes: ['Theft/Robbery', 'Assault'],
      peakHours: '20:00 - 02:00',
      confidence: 85,
      reasoning: 'High historical crime frequency in late evening hours',
    },
    {
      zone: 'Dagdusheth Halwai Temple Road',
      riskScore: 65,
      predictedCrimes: 8,
      crimeTypes: ['Drug Offense', 'Prohibition'],
      peakHours: '22:00 - 04:00',
      confidence: 80,
      reasoning: 'Pattern of substance-related offenses after hours',
    },
    {
      zone: 'Vivekananda Street',
      riskScore: 55,
      predictedCrimes: 5,
      crimeTypes: ['Theft/Robbery'],
      peakHours: '18:00 - 22:00',
      confidence: 75,
      reasoning: 'Opportunistic crimes during evening rush',
    },
    {
      zone: 'Near Theatre Area',
      riskScore: 48,
      predictedCrimes: 3,
      crimeTypes: ['Assault', 'Electricity Offense'],
      peakHours: '14:00 - 18:00',
      confidence: 70,
      reasoning: 'Mixed offense patterns in commercial zone',
    },
  ];
}
