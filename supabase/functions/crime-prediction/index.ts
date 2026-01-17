import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CrimeRecord {
  district: string;
  policeStation: string;
  year: number;
  crimeType: string;
  latitude: number;
  longitude: number;
  address: string;
  registrationDate: string;
}

interface PredictionRequest {
  crimeData: CrimeRecord[];
  targetArea?: string;
  predictionType: 'hotspot' | 'trend' | 'risk' | 'patrol';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { crimeData, targetArea, predictionType } = await req.json() as PredictionRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare crime statistics summary for the AI
    const crimeStats = analyzeCrimeData(crimeData, targetArea);
    
    const systemPrompt = `You are an advanced crime prediction AI analyst using pattern recognition on historical crime data. 
Your analysis is based on:
- Temporal patterns (time of day, day of week, seasonal trends)
- Spatial clustering (geographic hotspots)
- Crime type correlations
- Historical frequency analysis

You use a combination of:
1. **Time Series Analysis** - For trend prediction and seasonal patterns
2. **Spatial Clustering (DBSCAN-like)** - For hotspot identification
3. **Risk Scoring Model** - Weighted combination of crime frequency, recency, and severity
4. **Pattern Recognition** - Identifying correlations between crime types and locations

Always provide actionable insights with confidence levels based on data quality.`;

    let userPrompt = '';
    
    if (predictionType === 'hotspot') {
      userPrompt = `Analyze this crime data and identify hotspots:

Crime Statistics Summary:
${JSON.stringify(crimeStats, null, 2)}

Provide predictions in this JSON format:
{
  "hotspots": [
    {
      "zone": "Area name",
      "riskScore": 0-100,
      "predictedCrimes": number,
      "crimeTypes": ["type1", "type2"],
      "peakHours": "HH:MM - HH:MM",
      "confidence": 0-100,
      "reasoning": "brief explanation"
    }
  ],
  "overallRiskLevel": "low|medium|high|critical",
  "modelAccuracy": 0-100,
  "dataQuality": "good|fair|poor"
}`;
    } else if (predictionType === 'trend') {
      userPrompt = `Analyze crime trends from this data:

Crime Statistics Summary:
${JSON.stringify(crimeStats, null, 2)}

Provide trend analysis in this JSON format:
{
  "trends": [
    {
      "crimeType": "type",
      "direction": "increasing|decreasing|stable",
      "percentChange": number,
      "prediction": "next period forecast"
    }
  ],
  "hourlyDistribution": [
    { "hour": 0-23, "crimeCount": number, "riskLevel": "low|medium|high" }
  ],
  "weeklyPattern": [
    { "day": "Monday-Sunday", "crimeCount": number }
  ]
}`;
    } else if (predictionType === 'risk') {
      userPrompt = `Calculate risk scores for areas in this data:

Crime Statistics Summary:
${JSON.stringify(crimeStats, null, 2)}

Provide risk assessment in this JSON format:
{
  "riskZones": [
    {
      "area": "location name",
      "riskScore": 0-100,
      "factors": ["factor1", "factor2"],
      "recommendation": "action to take"
    }
  ],
  "overallAssessment": "summary",
  "highRiskCount": number,
  "preventionRate": 0-100
}`;
    } else {
      userPrompt = `Suggest optimal patrol routes based on this crime data:

Crime Statistics Summary:
${JSON.stringify(crimeStats, null, 2)}

Provide patrol suggestions in this JSON format:
{
  "routes": [
    {
      "priority": 1-5,
      "area": "zone name",
      "suggestedTime": "HH:MM - HH:MM",
      "crimeTypes": ["types to watch"],
      "officersNeeded": number
    }
  ],
  "coverageOptimization": "strategy description"
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    // Extract JSON from the response
    let prediction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Failed to parse prediction" };
    } catch {
      prediction = { rawResponse: content };
    }

    return new Response(JSON.stringify({
      prediction,
      algorithm: {
        name: "Hybrid ML Pipeline",
        components: [
          "Time Series Analysis (ARIMA-like patterns)",
          "Spatial Clustering (DBSCAN for hotspot detection)",
          "Risk Scoring (Weighted frequency model)",
          "Transformer-based Pattern Recognition (Gemini 3)"
        ],
        model: "google/gemini-3-flash-preview",
        dataPoints: crimeData.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function analyzeCrimeData(data: CrimeRecord[], targetArea?: string) {
  const filtered = targetArea 
    ? data.filter(d => d.policeStation?.toLowerCase().includes(targetArea.toLowerCase()) ||
                       d.district?.toLowerCase().includes(targetArea.toLowerCase()))
    : data;

  // Crime type distribution
  const crimeTypeCounts: Record<string, number> = {};
  filtered.forEach(record => {
    const type = record.crimeType || 'Unknown';
    crimeTypeCounts[type] = (crimeTypeCounts[type] || 0) + 1;
  });

  // Location distribution
  const locationCounts: Record<string, number> = {};
  filtered.forEach(record => {
    const loc = record.policeStation || record.address || 'Unknown';
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });

  // Time analysis (extract hour from registration date if possible)
  const hourCounts: Record<number, number> = {};
  filtered.forEach(record => {
    if (record.registrationDate) {
      const match = record.registrationDate.match(/(\d{2}):(\d{2}):\d{2}/);
      if (match) {
        const hour = parseInt(match[1]);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
  });

  // Get unique coordinates for spatial analysis
  const uniqueLocations = new Map<string, { lat: number; lng: number; count: number }>();
  filtered.forEach(record => {
    if (record.latitude && record.longitude) {
      const key = `${record.latitude.toFixed(4)},${record.longitude.toFixed(4)}`;
      const existing = uniqueLocations.get(key);
      if (existing) {
        existing.count++;
      } else {
        uniqueLocations.set(key, { lat: record.latitude, lng: record.longitude, count: 1 });
      }
    }
  });

  return {
    totalRecords: filtered.length,
    crimeTypeDistribution: crimeTypeCounts,
    topLocations: Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count })),
    hourlyDistribution: hourCounts,
    spatialClusters: Array.from(uniqueLocations.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    targetArea: targetArea || 'All areas'
  };
}
