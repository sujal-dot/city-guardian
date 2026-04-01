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
  incidentCount?: number;
  riskScore?: number;
}

interface PredictionRequest {
  crimeData: CrimeRecord[];
  targetArea?: string;
  predictionType: "hotspot" | "trend" | "risk" | "patrol";
}

interface ForestRow {
  label: string;
  features: number[];
  weight: number;
}

interface LeafNode {
  leaf: true;
  probabilities: { crimeType: string; probability: number }[];
}

interface SplitNode {
  leaf: false;
  featureIndex: number;
  threshold: number;
  left: TreeNode;
  right: TreeNode;
}

type TreeNode = LeafNode | SplitNode;

const FEATURE_COUNT = 7;
const TREE_COUNT = 21;
const MAX_DEPTH = 5;
const MIN_SAMPLES = 8;
const FEATURES_PER_SPLIT = 3;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseDateSafe = (value?: string) => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getHourFromDateString = (value?: string) => {
  if (!value) return 12;
  const match = String(value).match(/(?:T|\s)(\d{2}):/);
  if (!match) return 12;
  const hour = Number.parseInt(match[1], 10);
  return Number.isFinite(hour) ? clamp(hour, 0, 23) : 12;
};

const toFeatureVector = (record: CrimeRecord, now = new Date()): number[] => {
  const eventDate = parseDateSafe(record.registrationDate);
  const daysSinceReported = Math.round(
    Math.max(0, now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return [
    Number(record.latitude || 0),
    Number(record.longitude || 0),
    getHourFromDateString(record.registrationDate),
    eventDate.getDay(),
    eventDate.getMonth() + 1,
    clamp(Number(record.riskScore || 50), 0, 100),
    clamp(daysSinceReported, 0, 3650),
  ];
};

const buildRows = (records: CrimeRecord[]): ForestRow[] =>
  records
    .filter((record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude))
    .map((record) => ({
      label: record.crimeType || "Unknown",
      features: toFeatureVector(record),
      weight: clamp(Number(record.incidentCount || 1), 1, 30),
    }));

const gini = (rows: ForestRow[]) => {
  let totalWeight = 0;
  const classWeight = new Map<string, number>();
  for (const row of rows) {
    totalWeight += row.weight;
    classWeight.set(row.label, (classWeight.get(row.label) || 0) + row.weight);
  }
  if (totalWeight === 0) return 0;

  let impurity = 1;
  for (const weight of classWeight.values()) {
    const probability = weight / totalWeight;
    impurity -= probability * probability;
  }
  return impurity;
};

const summarizeLeaf = (rows: ForestRow[]): LeafNode => {
  let totalWeight = 0;
  const classWeight = new Map<string, number>();

  for (const row of rows) {
    totalWeight += row.weight;
    classWeight.set(row.label, (classWeight.get(row.label) || 0) + row.weight);
  }

  const probabilities = Array.from(classWeight.entries())
    .map(([crimeType, weight]) => ({
      crimeType,
      probability: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
    }))
    .sort((a, b) => b.probability - a.probability);

  return { leaf: true, probabilities };
};

const randomFeatureSubset = (count: number, subsetSize: number) => {
  const features = Array.from({ length: count }, (_, i) => i);
  for (let i = features.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [features[i], features[j]] = [features[j], features[i]];
  }
  return features.slice(0, subsetSize);
};

const findSplit = (rows: ForestRow[]) => {
  const candidates = randomFeatureSubset(FEATURE_COUNT, FEATURES_PER_SPLIT);
  let bestImpurity = Number.POSITIVE_INFINITY;
  let best: null | { featureIndex: number; threshold: number; left: ForestRow[]; right: ForestRow[] } = null;

  for (const featureIndex of candidates) {
    const sorted = [...rows].sort((a, b) => a.features[featureIndex] - b.features[featureIndex]);
    if (sorted.length < 2) continue;

    const stride = Math.max(1, Math.floor(sorted.length / 8));
    for (let i = stride; i < sorted.length; i += stride) {
      const leftValue = sorted[i - 1].features[featureIndex];
      const rightValue = sorted[i].features[featureIndex];
      if (leftValue === rightValue) continue;

      const threshold = (leftValue + rightValue) / 2;
      const left: ForestRow[] = [];
      const right: ForestRow[] = [];

      for (const row of sorted) {
        if (row.features[featureIndex] <= threshold) {
          left.push(row);
        } else {
          right.push(row);
        }
      }

      if (left.length === 0 || right.length === 0) continue;

      const leftWeight = left.reduce((sum, row) => sum + row.weight, 0);
      const rightWeight = right.reduce((sum, row) => sum + row.weight, 0);
      const totalWeight = leftWeight + rightWeight;
      const impurity = (leftWeight / totalWeight) * gini(left) + (rightWeight / totalWeight) * gini(right);

      if (impurity < bestImpurity) {
        bestImpurity = impurity;
        best = { featureIndex, threshold, left, right };
      }
    }
  }

  return best;
};

const buildTree = (rows: ForestRow[], depth = 0): TreeNode => {
  if (rows.length < MIN_SAMPLES || depth >= MAX_DEPTH || gini(rows) < 0.01) {
    return summarizeLeaf(rows);
  }
  const split = findSplit(rows);
  if (!split) return summarizeLeaf(rows);

  return {
    leaf: false,
    featureIndex: split.featureIndex,
    threshold: split.threshold,
    left: buildTree(split.left, depth + 1),
    right: buildTree(split.right, depth + 1),
  };
};

const bootstrap = (rows: ForestRow[]) => {
  const sampled: ForestRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    sampled.push(rows[Math.floor(Math.random() * rows.length)]);
  }
  return sampled;
};

const predictTree = (tree: TreeNode, features: number[]) => {
  let node = tree;
  while (!node.leaf) {
    node = features[node.featureIndex] <= node.threshold ? node.left : node.right;
  }
  return node.probabilities;
};

const predictProbabilities = (trees: TreeNode[], features: number[]) => {
  const totals = new Map<string, number>();

  for (const tree of trees) {
    const probabilities = predictTree(tree, features);
    probabilities.forEach((entry) => {
      totals.set(entry.crimeType, (totals.get(entry.crimeType) || 0) + entry.probability);
    });
  }

  const averaged = Array.from(totals.entries())
    .map(([crimeType, score]) => ({
      crimeType,
      probability: score / Math.max(trees.length, 1),
    }))
    .sort((a, b) => b.probability - a.probability);

  const total = averaged.reduce((sum, item) => sum + item.probability, 0) || 1;
  return averaged.slice(0, 5).map((item) => ({
    crimeType: item.crimeType,
    probability: Number(((item.probability / total) * 100).toFixed(1)),
  }));
};

const trainForest = (records: CrimeRecord[]) => {
  const rows = buildRows(records);
  if (rows.length < 10) {
    throw new Error("Not enough crime data to train Random Forest model.");
  }

  const trees: TreeNode[] = [];
  for (let i = 0; i < TREE_COUNT; i += 1) {
    trees.push(buildTree(bootstrap(rows)));
  }

  const sampleSize = Math.min(rows.length, 120);
  let correct = 0;
  for (let i = 0; i < sampleSize; i += 1) {
    const row = rows[Math.floor(Math.random() * rows.length)];
    const prediction = predictProbabilities(trees, row.features)[0]?.crimeType;
    if (prediction === row.label) correct += 1;
  }

  return {
    trees,
    accuracy: Number(((correct / Math.max(sampleSize, 1)) * 100).toFixed(1)),
  };
};

const zoneSummaries = (records: CrimeRecord[], trees: TreeNode[], accuracy: number) => {
  const zones = new Map<
    string,
    {
      zoneName: string;
      weightedLat: number;
      weightedLng: number;
      totalWeight: number;
      riskWeighted: number;
      totalIncidents: number;
      hourCounts: number[];
    }
  >();

  records.forEach((record) => {
    const zoneKey = (record.policeStation || record.address || "Unknown").toLowerCase();
    const zoneName = record.policeStation || record.address || "Unknown";
    const weight = clamp(Number(record.incidentCount || 1), 1, 50);
    const risk = clamp(Number(record.riskScore || 50), 0, 100);
    const hour = getHourFromDateString(record.registrationDate);

    if (!zones.has(zoneKey)) {
      zones.set(zoneKey, {
        zoneName,
        weightedLat: 0,
        weightedLng: 0,
        totalWeight: 0,
        riskWeighted: 0,
        totalIncidents: 0,
        hourCounts: Array.from({ length: 24 }, () => 0),
      });
    }

    const zone = zones.get(zoneKey)!;
    zone.weightedLat += Number(record.latitude) * weight;
    zone.weightedLng += Number(record.longitude) * weight;
    zone.totalWeight += weight;
    zone.totalIncidents += weight;
    zone.riskWeighted += risk * weight;
    zone.hourCounts[hour] += weight;
  });

  return Array.from(zones.values()).map((zone) => {
    const latitude = zone.weightedLat / Math.max(zone.totalWeight, 1);
    const longitude = zone.weightedLng / Math.max(zone.totalWeight, 1);
    const avgRisk = zone.riskWeighted / Math.max(zone.totalWeight, 1);
    const probabilities = predictProbabilities(
      trees,
      toFeatureVector({
        district: zone.zoneName,
        policeStation: zone.zoneName,
        year: new Date().getFullYear(),
        crimeType: "",
        latitude,
        longitude,
        address: zone.zoneName,
        registrationDate: new Date().toISOString(),
        incidentCount: Math.max(1, Math.round(zone.totalIncidents / 3)),
        riskScore: avgRisk,
      })
    );
    const topCrime = probabilities[0];
    const riskScore = clamp(
      Math.round(avgRisk * 0.55 + (topCrime?.probability || 0) * 0.35 + Math.min(zone.totalIncidents, 45) * 0.5),
      20,
      100
    );
    const peakHour = zone.hourCounts.reduce(
      (bestHour, count, hour) => (count > zone.hourCounts[bestHour] ? hour : bestHour),
      0
    );

    return {
      zone: zone.zoneName,
      riskScore,
      predictedCrimes: Math.max(1, Math.round(zone.totalIncidents * (0.35 + avgRisk / 180))),
      confidence: clamp(Math.round(accuracy * 0.65 + (topCrime?.probability || 0) * 0.35), 45, 98),
      peakHours: `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 4) % 24).padStart(2, "0")}:00`,
      topCrimeType: topCrime?.crimeType || "Unknown",
      topCrimeProbability: topCrime?.probability || 0,
      crimeProbabilities: probabilities.slice(0, 3),
      crimeTypes: probabilities.slice(0, 3).map((item) => item.crimeType),
      totalIncidents: zone.totalIncidents,
    };
  });
};

const buildPrediction = (records: CrimeRecord[], predictionType: PredictionRequest["predictionType"]) => {
  const { trees, accuracy } = trainForest(records);
  const zones = zoneSummaries(records, trees, accuracy).sort((a, b) => b.riskScore - a.riskScore);
  const avgRisk = zones.length ? zones.reduce((sum, zone) => sum + zone.riskScore, 0) / zones.length : 0;

  if (predictionType === "hotspot") {
    return {
      hotspots: zones.slice(0, 10).map((zone) => ({
        zone: zone.zone,
        riskScore: zone.riskScore,
        predictedCrimes: zone.predictedCrimes,
        crimeTypes: zone.crimeTypes,
        crimeTypeProbabilities: zone.crimeProbabilities,
        topCrimeType: zone.topCrimeType,
        topCrimeProbability: zone.topCrimeProbability,
        peakHours: zone.peakHours,
        confidence: zone.confidence,
        reasoning: `${zone.topCrimeType} has the highest predicted probability (${zone.topCrimeProbability.toFixed(1)}%).`,
      })),
      overallRiskLevel: avgRisk >= 78 ? "critical" : avgRisk >= 62 ? "high" : avgRisk >= 42 ? "medium" : "low",
      modelAccuracy: accuracy,
      dataQuality: records.length > 300 ? "good" : records.length > 120 ? "fair" : "poor",
      highRiskCount: zones.filter((zone) => zone.riskScore >= 70).length,
    };
  }

  if (predictionType === "trend") {
    const now = new Date();
    const buckets = new Map<string, { recent: number; previous: number; total: number }>();
    const hourly = Array.from({ length: 24 }, () => 0);
    const weekly = DAY_NAMES.map((day) => ({ day, crimeCount: 0 }));

    records.forEach((record) => {
      const date = parseDateSafe(record.registrationDate);
      const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo > 60) return;
      const type = record.crimeType || "Unknown";
      const weight = clamp(Number(record.incidentCount || 1), 1, 50);
      if (!buckets.has(type)) {
        buckets.set(type, { recent: 0, previous: 0, total: 0 });
      }
      const bucket = buckets.get(type)!;
      if (daysAgo <= 30) bucket.recent += weight;
      else bucket.previous += weight;
      bucket.total += weight;
      hourly[getHourFromDateString(record.registrationDate)] += weight;
      weekly[date.getDay()].crimeCount += weight;
    });

    const maxHourly = Math.max(...hourly, 1);
    return {
      trends: Array.from(buckets.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(([crimeType, bucket]) => {
          const baseline = Math.max(bucket.previous, 1);
          const percentChange = Number((((bucket.recent - bucket.previous) / baseline) * 100).toFixed(1));
          const direction =
            percentChange > 12 ? "increasing" : percentChange < -12 ? "decreasing" : "stable";
          return {
            crimeType,
            direction,
            percentChange,
            prediction:
              direction === "increasing"
                ? `Likely rise in ${crimeType} next week.`
                : direction === "decreasing"
                ? `Expected reduction for ${crimeType}.`
                : `Pattern remains stable for ${crimeType}.`,
          };
        }),
      hourlyDistribution: hourly.map((crimeCount, hour) => ({
        hour,
        crimeCount: Math.round(crimeCount),
        riskLevel:
          crimeCount / maxHourly > 0.66
            ? "high"
            : crimeCount / maxHourly > 0.33
            ? "medium"
            : "low",
      })),
      weeklyPattern: weekly.map((item) => ({
        day: item.day,
        crimeCount: Math.round(item.crimeCount),
      })),
      modelAccuracy: accuracy,
    };
  }

  if (predictionType === "risk") {
    const riskZones = zones.slice(0, 10).map((zone) => ({
      area: zone.zone,
      riskScore: zone.riskScore,
      factors: [
        `Likely crime: ${zone.topCrimeType} (${zone.topCrimeProbability.toFixed(1)}%)`,
        `Historical incident weight: ${zone.totalIncidents}`,
        `Peak alert window: ${zone.peakHours}`,
      ],
      recommendation:
        zone.riskScore >= 75
          ? "Deploy rapid response units and issue immediate public alerts."
          : zone.riskScore >= 60
          ? "Increase patrols and share citizen travel warnings."
          : "Maintain routine patrol and awareness.",
    }));
    const highRiskCount = riskZones.filter((zone) => zone.riskScore >= 70).length;
    return {
      riskZones,
      overallAssessment:
        highRiskCount > 0
          ? `${highRiskCount} zones need immediate preventive coverage.`
          : "No critical zones detected.",
      highRiskCount,
      preventionRate: clamp(Math.round(accuracy * 0.75 + (100 - highRiskCount * 4) * 0.25), 55, 96),
      modelAccuracy: accuracy,
    };
  }

  return {
    routes: zones.slice(0, 8).map((zone, index) => ({
      priority: index + 1,
      area: zone.zone,
      suggestedTime: zone.peakHours,
      crimeTypes: zone.crimeTypes.slice(0, 2),
      officersNeeded: clamp(Math.round(zone.riskScore / 22), 2, 8),
    })),
    coverageOptimization:
      "Prioritize top-risk corridors first, then rotate patrols to adjacent medium-risk zones.",
    modelAccuracy: accuracy,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { crimeData, targetArea, predictionType } = (await req.json()) as PredictionRequest;

    if (!Array.isArray(crimeData) || crimeData.length === 0) {
      throw new Error("crimeData is required");
    }

    const filtered = targetArea
      ? crimeData.filter(
          (row) =>
            row.policeStation?.toLowerCase().includes(targetArea.toLowerCase()) ||
            row.district?.toLowerCase().includes(targetArea.toLowerCase())
        )
      : crimeData;

    if (filtered.length < 10) {
      throw new Error("Not enough records for this area to run Random Forest prediction.");
    }

    const normalizedType: PredictionRequest["predictionType"] =
      predictionType === "trend" || predictionType === "risk" || predictionType === "patrol"
        ? predictionType
        : "hotspot";

    const prediction = buildPrediction(filtered, normalizedType);

    return new Response(
      JSON.stringify({
        prediction,
        algorithm: {
          name: "Random Forest Crime Predictor",
          components: [
            "Bootstrap Aggregation (Bagging)",
            "Decision Tree Ensemble",
            "Feature Randomization Per Split",
            "Probability Voting for Crime Type Forecasting",
          ],
          model: "random-forest-v1",
          dataPoints: filtered.length,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
