import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '2mb' }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

const PREDICTION_MODEL = process.env.PREDICTION_MODEL || 'random-forest-v1';
const PICKLE_MODEL_NAME = process.env.PICKLE_MODEL_NAME || 'random-forest-pkl-v1';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const USE_PICKLE_MODEL = process.env.USE_PICKLE_MODEL !== 'false';
const PICKLE_MODEL_PATH = process.env.PICKLE_MODEL_PATH || path.join(__dirname, 'ml', 'models', 'random_forest_model.pkl');
const PICKLE_METADATA_PATH = process.env.PICKLE_METADATA_PATH || path.join(__dirname, 'ml', 'models', 'random_forest_model.meta.json');
const PICKLE_PREDICT_SCRIPT = path.join(__dirname, 'ml', 'predict_with_model.py');
const PICKLE_TRAIN_SCRIPT = path.join(__dirname, 'ml', 'train_random_forest.py');
const PREDICTION_LIMIT = Number(process.env.PREDICTION_LIMIT || 500);
const HOTSPOT_MIN_RISK_SCORE = Number(process.env.HOTSPOT_MIN_RISK_SCORE || 70);
const HOTSPOT_CACHE_MS = Number(process.env.HOTSPOT_CACHE_MS || 5 * 60 * 1000);
const RANDOM_FOREST_TREE_COUNT = Number(process.env.RF_TREE_COUNT || 25);
const RANDOM_FOREST_MAX_DEPTH = Number(process.env.RF_MAX_DEPTH || 5);
const RANDOM_FOREST_MIN_SAMPLES = Number(process.env.RF_MIN_SAMPLES || 8);
const RANDOM_FOREST_FEATURES_PER_SPLIT = Number(process.env.RF_FEATURES_PER_SPLIT || 3);
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;

const INCIDENT_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const INCIDENT_STATUSES = new Set(['reported', 'investigating', 'resolved', 'closed']);
const INCIDENT_SOURCES = new Set(['citizen', 'police', 'admin', 'system']);
const APP_ROLES = new Set(['citizen', 'police', 'admin']);
const SOS_STATUSES = new Set(['active', 'responding', 'resolved']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_RADIUS_METERS = 400;
const MAX_RADIUS_METERS = 2500;
const FEATURE_NAMES = [
  'latitude',
  'longitude',
  'hourOfDay',
  'dayOfWeek',
  'month',
  'incidentCount',
  'riskScore',
  'daysSinceReported',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_TREND_LOOKBACK_DAYS = 60;
const RECENT_TREND_DAYS = 30;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePositiveInt = (value, fallback, max = 200) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return clamp(parsed, 1, max);
};

const parseOptionalUuid = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return UUID_REGEX.test(normalized) ? normalized : null;
};

const isMissingIncidentSourceColumnError = (error) => {
  if (!error || typeof error !== 'object') return false;
  const code = typeof error.code === 'string' ? error.code : '';
  const message = String(error.message || '').toLowerCase();
  return code === 'PGRST204' && message.includes('incident_source') && message.includes('column');
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sanitizeSearchTerm = (value) => String(value ?? '').trim().replace(/[,]/g, ' ');

const calculateRadiusMeters = (riskScore, incidentCount = 0) => {
  const scoreBoost = (riskScore / 100) * 1200;
  const incidentBoost = Math.min(incidentCount * 15, 600);
  return Math.round(
    Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, MIN_RADIUS_METERS + scoreBoost + incidentBoost))
  );
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizePredictionType = (value) => {
  if (['hotspot', 'trend', 'risk', 'patrol'].includes(value)) {
    return value;
  }
  return 'hotspot';
};

const parseDateSafe = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const getHourFromDateString = (value) => {
  if (!value) return 12;
  const match = String(value).match(/(?:T|\s)(\d{2}):/);
  if (!match) return 12;
  const hour = Number.parseInt(match[1], 10);
  return Number.isFinite(hour) ? clamp(hour, 0, 23) : 12;
};

const getOverallRiskLevel = (score) => {
  if (score >= 78) return 'critical';
  if (score >= 62) return 'high';
  if (score >= 42) return 'medium';
  return 'low';
};

const formatHourRange = (startHour, duration = 4) => {
  const start = clamp(Math.round(startHour), 0, 23);
  const end = (start + duration) % 24;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start)}:00 - ${pad(end)}:00`;
};

const toFeatureVector = (record, now = new Date()) => {
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
    clamp(Number(record.incidentCount || 1), 1, 200),
    clamp(Number(record.riskScore || 50), 0, 100),
    clamp(daysSinceReported, 0, 3650),
  ];
};

const mapCrimeDataToRecords = (rows) =>
  rows.map((row) => {
    const recordedDate = parseDateSafe(row.recorded_date);
    return {
      district: row.zone_name || 'Unknown',
      policeStation: row.zone_name || 'Unknown',
      year: recordedDate.getFullYear(),
      crimeType: row.crime_type || 'Unknown',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.zone_name || 'Unknown',
      registrationDate: row.recorded_date || recordedDate.toISOString(),
      incidentCount: Number(row.incident_count || 1),
      riskScore: Number(row.risk_score || 50),
    };
  });

const buildTrainingRows = (records) =>
  records
    .filter((record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude))
    .map((record) => ({
      label: record.crimeType || 'Unknown',
      features: toFeatureVector(record),
      weight: clamp(Number(record.incidentCount || 1), 1, 30),
      record,
    }));

const calculateGiniImpurity = (rows) => {
  let totalWeight = 0;
  const classWeight = new Map();

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

const summarizeLeaf = (rows) => {
  const classWeight = new Map();
  let totalWeight = 0;

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

  return {
    leaf: true,
    probabilities,
    majorityClass: probabilities[0]?.crimeType || 'Unknown',
  };
};

const getRandomFeatureSubset = (featureCount, subsetSize) => {
  const features = Array.from({ length: featureCount }, (_, index) => index);
  for (let i = features.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [features[i], features[j]] = [features[j], features[i]];
  }
  return features.slice(0, subsetSize);
};

const findBestSplit = (rows, featureCount) => {
  const candidateFeatures = getRandomFeatureSubset(
    featureCount,
    Math.min(featureCount, RANDOM_FOREST_FEATURES_PER_SPLIT)
  );

  let bestSplit = null;
  let bestImpurity = Number.POSITIVE_INFINITY;
  let bestLeft = [];
  let bestRight = [];

  for (const featureIndex of candidateFeatures) {
    const sorted = [...rows].sort(
      (a, b) => a.features[featureIndex] - b.features[featureIndex]
    );

    if (sorted.length < 2) continue;

    const stride = Math.max(1, Math.floor(sorted.length / 8));

    for (let i = stride; i < sorted.length; i += stride) {
      const leftValue = sorted[i - 1].features[featureIndex];
      const rightValue = sorted[i].features[featureIndex];
      if (leftValue === rightValue) continue;

      const threshold = (leftValue + rightValue) / 2;
      const left = [];
      const right = [];

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
      const impurity =
        (leftWeight / totalWeight) * calculateGiniImpurity(left) +
        (rightWeight / totalWeight) * calculateGiniImpurity(right);

      if (impurity < bestImpurity) {
        bestImpurity = impurity;
        bestSplit = { featureIndex, threshold };
        bestLeft = left;
        bestRight = right;
      }
    }
  }

  if (!bestSplit) return null;

  return {
    ...bestSplit,
    left: bestLeft,
    right: bestRight,
  };
};

const buildDecisionTree = (rows, depth = 0) => {
  const isPure = calculateGiniImpurity(rows) < 0.01;

  if (
    rows.length < RANDOM_FOREST_MIN_SAMPLES ||
    depth >= RANDOM_FOREST_MAX_DEPTH ||
    isPure
  ) {
    return summarizeLeaf(rows);
  }

  const split = findBestSplit(rows, FEATURE_NAMES.length);
  if (!split) {
    return summarizeLeaf(rows);
  }

  return {
    leaf: false,
    featureIndex: split.featureIndex,
    threshold: split.threshold,
    left: buildDecisionTree(split.left, depth + 1),
    right: buildDecisionTree(split.right, depth + 1),
  };
};

const bootstrapSample = (rows) => {
  const sampled = [];
  for (let i = 0; i < rows.length; i += 1) {
    sampled.push(rows[Math.floor(Math.random() * rows.length)]);
  }
  return sampled;
};

const predictWithTree = (tree, features) => {
  let node = tree;
  while (!node.leaf) {
    node = features[node.featureIndex] <= node.threshold ? node.left : node.right;
  }
  return node.probabilities;
};

const predictClassProbabilities = (forest, features) => {
  const totals = new Map();

  for (const tree of forest.trees) {
    const distribution = predictWithTree(tree, features);
    for (const entry of distribution) {
      totals.set(entry.crimeType, (totals.get(entry.crimeType) || 0) + entry.probability);
    }
  }

  const averaged = Array.from(totals.entries())
    .map(([crimeType, score]) => ({
      crimeType,
      probability: score / Math.max(forest.trees.length, 1),
    }))
    .sort((a, b) => b.probability - a.probability);

  const normalizedTotal = averaged.reduce((sum, item) => sum + item.probability, 0) || 1;
  return averaged.slice(0, 5).map((item) => ({
    crimeType: item.crimeType,
    probability: Number(((item.probability / normalizedTotal) * 100).toFixed(1)),
  }));
};

const estimateTrainingAccuracy = (forest, rows) => {
  const sampleSize = Math.min(rows.length, 120);
  if (sampleSize === 0) return 0;

  let correct = 0;
  for (let i = 0; i < sampleSize; i += 1) {
    const row = rows[Math.floor(Math.random() * rows.length)];
    const topPrediction = predictClassProbabilities(forest, row.features)[0]?.crimeType;
    if (topPrediction === row.label) {
      correct += 1;
    }
  }

  return Number(((correct / sampleSize) * 100).toFixed(1));
};

const trainRandomForest = (records) => {
  const rows = buildTrainingRows(records);
  if (rows.length < 10) {
    throw new Error('Not enough crime data to train Random Forest model.');
  }

  const treeCount = clamp(RANDOM_FOREST_TREE_COUNT, 8, 80);
  const trees = [];

  for (let i = 0; i < treeCount; i += 1) {
    trees.push(buildDecisionTree(bootstrapSample(rows)));
  }

  const forest = { trees };
  return {
    ...forest,
    accuracy: estimateTrainingAccuracy(forest, rows),
  };
};

const buildZoneSummaries = (records, forest) => {
  const zoneMap = new Map();

  for (const record of records) {
    const zoneName = record.policeStation || record.address || 'Unknown';
    const key = zoneName.toLowerCase();
    const incidentWeight = clamp(Number(record.incidentCount || 1), 1, 50);
    const riskScore = clamp(Number(record.riskScore || 50), 0, 100);
    const eventDate = parseDateSafe(record.registrationDate);
    const hour = getHourFromDateString(record.registrationDate);

    if (!zoneMap.has(key)) {
      zoneMap.set(key, {
        zone: zoneName,
        weightedLat: 0,
        weightedLng: 0,
        totalWeight: 0,
        totalIncidents: 0,
        weightedRisk: 0,
        latestDate: eventDate,
        hourCounts: Array.from({ length: 24 }, () => 0),
      });
    }

    const zone = zoneMap.get(key);
    zone.weightedLat += Number(record.latitude) * incidentWeight;
    zone.weightedLng += Number(record.longitude) * incidentWeight;
    zone.totalWeight += incidentWeight;
    zone.totalIncidents += incidentWeight;
    zone.weightedRisk += riskScore * incidentWeight;
    zone.hourCounts[hour] += incidentWeight;
    if (eventDate > zone.latestDate) {
      zone.latestDate = eventDate;
    }
  }

  return Array.from(zoneMap.values()).map((zone) => {
    const latitude = zone.weightedLat / Math.max(zone.totalWeight, 1);
    const longitude = zone.weightedLng / Math.max(zone.totalWeight, 1);
    const avgRisk = zone.weightedRisk / Math.max(zone.totalWeight, 1);
    const representativeRecord = {
      latitude,
      longitude,
      incidentCount: Math.max(1, Math.round(zone.totalIncidents / 3)),
      riskScore: avgRisk,
      registrationDate: zone.latestDate.toISOString(),
    };

    const probabilities = predictClassProbabilities(forest, toFeatureVector(representativeRecord));
    const topProbability = probabilities[0]?.probability || 0;
    const topCrimeType = probabilities[0]?.crimeType || 'Unknown';
    const predictedCrimes = Math.max(1, Math.round(zone.totalIncidents * (0.4 + avgRisk / 170)));
    const riskScore = clamp(
      Math.round(avgRisk * 0.55 + topProbability * 0.35 + Math.min(zone.totalIncidents, 45) * 0.5),
      20,
      100
    );
    const peakHour = zone.hourCounts.reduce(
      (bestHour, count, hour) => (count > zone.hourCounts[bestHour] ? hour : bestHour),
      0
    );
    const confidence = clamp(
      Math.round((forest.accuracy * 0.65) + (topProbability * 0.35)),
      45,
      98
    );

    return {
      zone: zone.zone,
      latitude,
      longitude,
      totalIncidents: zone.totalIncidents,
      riskScore,
      predictedCrimes,
      peakHours: formatHourRange(peakHour),
      confidence,
      topCrimeType,
      topCrimeProbability: topProbability,
      crimeProbabilities: probabilities,
    };
  });
};

const buildTrendPrediction = (records, forest) => {
  const now = new Date();
  const crimeBuckets = new Map();
  const hourly = Array.from({ length: 24 }, () => 0);
  const weekday = DAY_NAMES.map((day) => ({ day, crimeCount: 0 }));

  for (const record of records) {
    const date = parseDateSafe(record.registrationDate);
    const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo > MAX_TREND_LOOKBACK_DAYS) continue;

    const type = record.crimeType || 'Unknown';
    const weight = clamp(Number(record.incidentCount || 1), 1, 50);
    const hour = getHourFromDateString(record.registrationDate);

    if (!crimeBuckets.has(type)) {
      crimeBuckets.set(type, { recent: 0, previous: 0, total: 0 });
    }

    const bucket = crimeBuckets.get(type);
    if (daysAgo <= RECENT_TREND_DAYS) {
      bucket.recent += weight;
    } else {
      bucket.previous += weight;
    }
    bucket.total += weight;

    hourly[hour] += weight;
    weekday[date.getDay()].crimeCount += weight;
  }

  const trends = Array.from(crimeBuckets.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([crimeType, bucket]) => {
      const baseline = Math.max(bucket.previous, 1);
      const percentChange = Number((((bucket.recent - bucket.previous) / baseline) * 100).toFixed(1));
      const direction =
        percentChange > 12 ? 'increasing' : percentChange < -12 ? 'decreasing' : 'stable';
      const probability = predictClassProbabilities(
        forest,
        toFeatureVector({
          latitude: 0,
          longitude: 0,
          incidentCount: Math.max(1, bucket.recent),
          riskScore: clamp(50 + percentChange / 2, 0, 100),
          registrationDate: now.toISOString(),
        })
      ).find((entry) => entry.crimeType === crimeType)?.probability || 0;

      const prediction =
        direction === 'increasing'
          ? `Likely rise in ${crimeType} next week (${Math.round(probability)}% signal).`
          : direction === 'decreasing'
          ? `Expected stabilization with lower ${crimeType} incidence.`
          : `Pattern remains stable for ${crimeType}.`;

      return {
        crimeType,
        direction,
        percentChange,
        prediction,
      };
    });

  const maxHourly = Math.max(...hourly, 1);
  const hourlyDistribution = hourly.map((crimeCount, hour) => {
    const ratio = crimeCount / maxHourly;
    return {
      hour,
      crimeCount: Math.round(crimeCount),
      riskLevel: ratio > 0.66 ? 'high' : ratio > 0.33 ? 'medium' : 'low',
    };
  });

  return {
    trends,
    hourlyDistribution,
    weeklyPattern: weekday.map((item) => ({
      day: item.day,
      crimeCount: Math.round(item.crimeCount),
    })),
  };
};

const buildRiskPrediction = (zoneSummaries, modelAccuracy) => {
  const riskZones = [...zoneSummaries]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10)
    .map((zone) => ({
      area: zone.zone,
      riskScore: zone.riskScore,
      factors: [
        `Likely crime: ${zone.topCrimeType} (${zone.topCrimeProbability.toFixed(1)}%)`,
        `Historical incident weight: ${zone.totalIncidents}`,
        `Peak alert window: ${zone.peakHours}`,
      ],
      recommendation:
        zone.riskScore >= 75
          ? 'Deploy rapid response unit and increase CCTV monitoring.'
          : zone.riskScore >= 60
          ? 'Increase patrol frequency and issue traveler alerts.'
          : 'Maintain routine patrol with targeted awareness.',
    }));

  const highRiskCount = riskZones.filter((zone) => zone.riskScore >= 70).length;
  const preventionRate = clamp(
    Math.round(modelAccuracy * 0.75 + (100 - highRiskCount * 4) * 0.25),
    55,
    96
  );

  return {
    riskZones,
    overallAssessment:
      highRiskCount > 0
        ? `${highRiskCount} zones need immediate preventive coverage based on Random Forest risk scoring.`
        : 'No critical zones detected; maintain preventive patrol coverage.',
    highRiskCount,
    preventionRate,
  };
};

const buildPatrolPrediction = (zoneSummaries) => ({
  routes: [...zoneSummaries]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map((zone, index) => ({
      priority: index + 1,
      area: zone.zone,
      suggestedTime: zone.peakHours,
      crimeTypes: zone.crimeProbabilities.slice(0, 2).map((entry) => entry.crimeType),
      officersNeeded: clamp(Math.round(zone.riskScore / 22), 2, 8),
    })),
  coverageOptimization:
    'Prioritize overlapping high-risk corridors first, then expand patrol rings based on travel alert triggers.',
});

const buildRandomForestPrediction = (predictionType, records) => {
  const forest = trainRandomForest(records);
  const zoneSummaries = buildZoneSummaries(records, forest)
    .sort((a, b) => b.riskScore - a.riskScore);
  const overallRiskScore = zoneSummaries.length
    ? zoneSummaries.reduce((sum, zone) => sum + zone.riskScore, 0) / zoneSummaries.length
    : 0;

  if (predictionType === 'hotspot') {
    const hotspots = zoneSummaries.slice(0, 10).map((zone) => ({
      zone: zone.zone,
      riskScore: zone.riskScore,
      predictedCrimes: zone.predictedCrimes,
      crimeTypes: zone.crimeProbabilities.slice(0, 3).map((entry) => entry.crimeType),
      crimeTypeProbabilities: zone.crimeProbabilities.slice(0, 3),
      topCrimeType: zone.topCrimeType,
      topCrimeProbability: zone.topCrimeProbability,
      peakHours: zone.peakHours,
      confidence: zone.confidence,
      reasoning: `${zone.topCrimeType} has the strongest class probability (${zone.topCrimeProbability.toFixed(1)}%) in this zone.`,
    }));

    return {
      hotspots,
      overallRiskLevel: getOverallRiskLevel(overallRiskScore),
      modelAccuracy: forest.accuracy,
      dataQuality:
        records.length > 300 ? 'good' : records.length > 120 ? 'fair' : 'poor',
      highRiskCount: hotspots.filter((zone) => zone.riskScore >= 70).length,
    };
  }

  if (predictionType === 'trend') {
    return {
      ...buildTrendPrediction(records, forest),
      modelAccuracy: forest.accuracy,
    };
  }

  if (predictionType === 'risk') {
    return {
      ...buildRiskPrediction(zoneSummaries, forest.accuracy),
      modelAccuracy: forest.accuracy,
    };
  }

  return {
    ...buildPatrolPrediction(zoneSummaries),
    modelAccuracy: forest.accuracy,
  };
};

const parseJsonFromOutput = (output) => {
  const trimmed = String(output || '').trim();
  if (!trimmed) {
    throw new Error('Python command returned empty output.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // Continue trying previous lines.
      }
    }
    throw new Error(`Failed to parse Python JSON output: ${trimmed.slice(0, 400)}`);
  }
};

const runPythonCommand = (args, timeoutMs = 60_000) =>
  new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      cwd: __dirname,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`Python command timed out after ${timeoutMs}ms.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python command failed with exit code ${code}.`));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });

const runPicklePrediction = async ({ predictionType, targetArea, records }) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'city-guardian-predict-'));
  const recordsPath = path.join(tempDir, 'records.json');

  try {
    await fs.writeFile(recordsPath, JSON.stringify(records), 'utf-8');
    const args = [
      PICKLE_PREDICT_SCRIPT,
      '--model-path',
      PICKLE_MODEL_PATH,
      '--records-path',
      recordsPath,
      '--prediction-type',
      predictionType,
    ];
    if (targetArea) {
      args.push('--target-area', String(targetArea));
    }

    const { stdout } = await runPythonCommand(args, 90_000);
    return parseJsonFromOutput(stdout);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const runPickleTraining = async (records) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'city-guardian-train-'));
  const recordsPath = path.join(tempDir, 'records.json');

  try {
    await fs.mkdir(path.dirname(PICKLE_MODEL_PATH), { recursive: true });
    await fs.writeFile(recordsPath, JSON.stringify(records), 'utf-8');
    const args = [
      PICKLE_TRAIN_SCRIPT,
      '--records-path',
      recordsPath,
      '--model-path',
      PICKLE_MODEL_PATH,
      '--metadata-path',
      PICKLE_METADATA_PATH,
    ];
    const { stdout } = await runPythonCommand(args, 180_000);
    return parseJsonFromOutput(stdout);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const runPrediction = async ({ predictionType, targetArea }) => {
  const normalizedType = normalizePredictionType(predictionType);

  const { data, error } = await supabase
    .from('crime_data')
    .select('zone_name, latitude, longitude, crime_type, incident_count, risk_score, recorded_date')
    .order('recorded_date', { ascending: false })
    .limit(PREDICTION_LIMIT);

  if (error) {
    throw new Error(`Failed to load crime data: ${error.message}`);
  }

  const crimeRecords = mapCrimeDataToRecords(data || []);
  if (crimeRecords.length === 0) {
    throw new Error('No crime data available for prediction.');
  }

  const filteredRecords = targetArea
    ? crimeRecords.filter((record) =>
        record.policeStation?.toLowerCase().includes(String(targetArea).toLowerCase()) ||
        record.district?.toLowerCase().includes(String(targetArea).toLowerCase())
      )
    : crimeRecords;

  if (filteredRecords.length < 10) {
    throw new Error('Not enough records for this area to run Random Forest prediction.');
  }

  let prediction = null;
  let modelName = PREDICTION_MODEL;

  if (USE_PICKLE_MODEL) {
    try {
      const pickleResult = await runPicklePrediction({
        predictionType: normalizedType,
        targetArea,
        records: filteredRecords,
      });
      prediction = pickleResult.prediction;
      modelName = pickleResult.model || PICKLE_MODEL_NAME;
    } catch (error) {
      console.warn(`Pickle model prediction failed, falling back to in-memory model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!prediction) {
    prediction = buildRandomForestPrediction(normalizedType, filteredRecords);
  }

  const { error: insertError } = await supabase
    .from('crime_predictions')
    .insert({
      prediction_type: normalizedType,
      target_area: targetArea || null,
      data_points: filteredRecords.length,
      model: modelName,
      prediction,
    });

  if (insertError) {
    console.error('Failed to store prediction:', insertError);
  }

  return {
    predictionType: normalizedType,
    prediction,
    dataPoints: filteredRecords.length,
    model: modelName,
    createdAt: new Date().toISOString(),
  };
};

let hotspotCache = [];
let hotspotCacheUpdatedAt = 0;

const loadHotspotsFromPrediction = async () => {
  const { data: latestPrediction, error } = await supabase
    .from('crime_predictions')
    .select('prediction')
    .eq('prediction_type', 'hotspot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !latestPrediction?.prediction?.hotspots) {
    return [];
  }

  const hotspotZones = latestPrediction.prediction.hotspots
    .map((hotspot) => ({
      zone: hotspot.zone,
      riskScore: Number(hotspot.riskScore || 0),
      predictedCrimes: Number(hotspot.predictedCrimes || 0),
    }))
    .filter((hotspot) => hotspot.zone);

  if (hotspotZones.length === 0) {
    return [];
  }

  const zoneNames = hotspotZones.map((hotspot) => hotspot.zone);
  const { data: crimeZones, error: zoneError } = await supabase
    .from('crime_data')
    .select('zone_name, latitude, longitude, risk_score, incident_count')
    .in('zone_name', zoneNames);

  if (zoneError || !crimeZones) {
    return [];
  }

  const zoneLookup = new Map(
    crimeZones.map((zone) => [zone.zone_name, zone])
  );

  return hotspotZones
    .map((hotspot) => {
      const zoneData = zoneLookup.get(hotspot.zone);
      if (!zoneData) return null;
      const riskScore = hotspot.riskScore || Number(zoneData.risk_score || 0);
      const incidentCount = hotspot.predictedCrimes || Number(zoneData.incident_count || 0);
      return {
        zone: hotspot.zone,
        latitude: Number(zoneData.latitude),
        longitude: Number(zoneData.longitude),
        riskScore,
        radiusMeters: calculateRadiusMeters(riskScore, incidentCount),
        source: 'prediction',
      };
    })
    .filter(Boolean);
};

const loadHotspots = async () => {
  const now = Date.now();
  if (now - hotspotCacheUpdatedAt < HOTSPOT_CACHE_MS && hotspotCache.length > 0) {
    return hotspotCache;
  }

  const predictionHotspots = await loadHotspotsFromPrediction();
  if (predictionHotspots.length > 0) {
    hotspotCache = predictionHotspots;
    hotspotCacheUpdatedAt = now;
    return hotspotCache;
  }

  const { data: crimeData, error: crimeError } = await supabase
    .from('crime_data')
    .select('zone_name, latitude, longitude, risk_score, incident_count')
    .gte('risk_score', HOTSPOT_MIN_RISK_SCORE)
    .order('risk_score', { ascending: false })
    .limit(50);

  if (!crimeError && crimeData?.length) {
    hotspotCache = crimeData.map((zone) => ({
      zone: zone.zone_name,
      latitude: Number(zone.latitude),
      longitude: Number(zone.longitude),
      riskScore: Number(zone.risk_score || 0),
      radiusMeters: calculateRadiusMeters(Number(zone.risk_score || 0), Number(zone.incident_count || 0)),
      source: 'prediction',
    }));
    hotspotCacheUpdatedAt = now;
    return hotspotCache;
  }

  const { data: geofenceZones, error: geofenceError } = await supabase
    .from('high_risk_zones')
    .select('zone_name, latitude, longitude, radius_meters, risk_level')
    .eq('is_active', true);

  if (!geofenceError && geofenceZones?.length) {
    hotspotCache = geofenceZones.map((zone) => ({
      zone: zone.zone_name,
      latitude: Number(zone.latitude),
      longitude: Number(zone.longitude),
      riskScore: zone.risk_level === 'critical' ? 85 : zone.risk_level === 'high' ? 70 : 50,
      radiusMeters: Number(zone.radius_meters || MIN_RADIUS_METERS),
      source: 'geofence',
    }));
    hotspotCacheUpdatedAt = now;
    return hotspotCache;
  }

  hotspotCache = [];
  hotspotCacheUpdatedAt = now;
  return hotspotCache;
};

const matchIncidentToHotspot = async (incident) => {
  const hotspots = await loadHotspots();
  if (!hotspots.length) return null;

  let closest = null;

  hotspots.forEach((hotspot) => {
    const distanceKm = calculateDistanceKm(
      Number(incident.latitude),
      Number(incident.longitude),
      hotspot.latitude,
      hotspot.longitude
    );

    if (distanceKm <= hotspot.radiusMeters / 1000) {
      if (!closest || distanceKm < closest.distanceKm) {
        closest = {
          hotspot,
          distanceKm,
        };
      }
    }
  });

  if (!closest) return null;

  return {
    hotspot: closest.hotspot,
    distanceMeters: Math.round(closest.distanceKm * 1000),
  };
};

const createAlertForIncident = async (incident) => {
  const match = await matchIncidentToHotspot(incident);
  if (!match) return;

  const { hotspot, distanceMeters } = match;

  const { error } = await supabase
    .from('crime_alerts')
    .insert({
      incident_id: incident.id,
      incident_title: incident.title,
      incident_type: incident.incident_type,
      severity: incident.severity,
      location_name: incident.location_name,
      latitude: Number(incident.latitude),
      longitude: Number(incident.longitude),
      matched_zone: hotspot.zone,
      matched_risk_score: hotspot.riskScore,
      matched_distance_meters: distanceMeters,
      matched_radius_meters: hotspot.radiusMeters,
      source: hotspot.source,
    });

  if (error && error.code !== '23505') {
    console.error('Failed to create crime alert:', error);
  }
};

const startIncidentWatcher = async () => {
  await loadHotspots();

  supabase
    .channel('incident_alerts_backend')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'incidents' },
      (payload) => {
        createAlertForIncident(payload.new).catch((error) => {
          console.error('Alert generation failed:', error);
        });
      }
    )
    .subscribe();
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sendTravelAlertEmail = async ({
  to,
  zoneName,
  distanceMeters,
  riskLevel,
  likelyCrimeType,
  probability,
  latitude,
  longitude,
}) => {
  if (!RESEND_API_KEY || !ALERT_EMAIL_FROM) {
    return { status: 'skipped', reason: 'email_not_configured' };
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  const subject = `City Guardian Alert: ${zoneName} (${riskLevel} risk)`;
  const text = [
    `Safety alert for ${zoneName}`,
    `Risk level: ${riskLevel}`,
    `Likely crime: ${likelyCrimeType} (${probability}% probability)`,
    `Distance from your location: ${distanceMeters} meters`,
    `Map: ${mapsUrl}`,
    'Please stay alert and avoid isolated routes.',
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email delivery failed: ${response.status} ${errorText}`);
  }

  return { status: 'sent' };
};

app.get('/complaints/user/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const limit = parsePositiveInt(req.query.limit, 100, 500);
    const { data, error } = await supabase
      .from('complaints')
      .select('id, complaint_type, description, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const complaints = (data || []).map((complaint) => ({
      complaint_id: complaint.id,
      title: complaint.complaint_type,
      description: complaint.description || '',
      status: complaint.status,
      created_at: complaint.created_at,
      file_url: null,
    }));

    return res.json({ complaints });
  } catch (error) {
    console.error('Failed to fetch complaints:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch complaints.',
    });
  }
});

app.post('/incidents', async (req, res) => {
  try {
    const {
      title,
      incident_type,
      severity = 'medium',
      status = 'reported',
      location_name,
      latitude,
      longitude,
      description,
      assigned_officer,
      reported_by,
      incident_source = 'police',
    } = req.body ?? {};

    if (!title || !incident_type || !location_name) {
      return res.status(400).json({ error: 'Title, incident type, and location are required.' });
    }

    if (!INCIDENT_SEVERITIES.has(severity)) {
      return res.status(400).json({ error: 'Invalid severity value.' });
    }

    if (!INCIDENT_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    if (!INCIDENT_SOURCES.has(incident_source)) {
      return res.status(400).json({ error: 'Invalid incident source value.' });
    }

    const lat = parseNumber(latitude);
    const lng = parseNumber(longitude);

    if (lat === null || lng === null) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    const baseInsertPayload = {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      incident_type: String(incident_type).trim(),
      severity,
      status,
      location_name: String(location_name).trim(),
      latitude: lat,
      longitude: lng,
      reported_by: parseOptionalUuid(reported_by),
      assigned_officer: assigned_officer ? String(assigned_officer).trim() : null,
    };

    let { data, error } = await supabase
      .from('incidents')
      .insert({
        ...baseInsertPayload,
        incident_source,
      })
      .select('*')
      .single();

    // Backward compatibility for databases where incident_source migration was not applied yet.
    if (isMissingIncidentSourceColumnError(error)) {
      const fallbackResult = await supabase
        .from('incidents')
        .insert(baseInsertPayload)
        .select('*')
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      throw error;
    }

    res.json({ incident: data });
  } catch (error) {
    console.error('Failed to create incident:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create incident.' });
  }
});

app.post('/sos-alerts', async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      status = 'active',
      user_id,
    } = req.body ?? {};

    const lat = parseNumber(latitude);
    const lng = parseNumber(longitude);
    const normalizedStatus = String(status || 'active').trim().toLowerCase();

    if (lat === null || lng === null) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    if (!SOS_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid SOS status value.' });
    }

    const { data, error } = await supabase
      .from('sos_alerts')
      .insert({
        latitude: lat,
        longitude: lng,
        status: normalizedStatus,
        user_id: parseOptionalUuid(user_id),
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ alert: data });
  } catch (error) {
    console.error('Failed to create SOS alert:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create SOS alert.',
    });
  }
});

app.get('/sos-alerts', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const limit = parsePositiveInt(req.query.limit, 100, 500);

    let query = supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      if (!SOS_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid SOS status filter.' });
      }
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return res.json({ alerts: data || [] });
  } catch (error) {
    console.error('Failed to fetch SOS alerts:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch SOS alerts.',
    });
  }
});

app.patch('/sos-alerts/:alertId', async (req, res) => {
  try {
    const alertId = String(req.params.alertId || '').trim();
    const status = String(req.body?.status || '').trim().toLowerCase();

    if (!alertId) {
      return res.status(400).json({ error: 'Alert ID is required.' });
    }

    if (!SOS_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid SOS status value.' });
    }

    const updateData = {
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('sos_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return res.json({ alert: data });
  } catch (error) {
    console.error('Failed to update SOS alert:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update SOS alert.',
    });
  }
});

const fetchUsersWithRoles = async ({ searchTerm = '', limit = 5 }) => {
  const normalizedSearch = sanitizeSearchTerm(searchTerm);

  let profilesQuery = supabase
    .from('profiles')
    .select('user_id, full_name, created_at')
    .order('created_at', { ascending: false });

  if (normalizedSearch) {
    profilesQuery = profilesQuery
      .or(`full_name.ilike.%${normalizedSearch}%,user_id.ilike.%${normalizedSearch}%`)
      .limit(100);
  } else {
    profilesQuery = profilesQuery.limit(limit);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) {
    throw new Error(profilesError.message);
  }

  let rolesQuery = supabase
    .from('user_roles')
    .select('user_id, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (normalizedSearch) {
    rolesQuery = rolesQuery.ilike('user_id', `%${normalizedSearch}%`);
  }

  const { data: roles, error: rolesError } = await rolesQuery;
  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const profileRows = profiles || [];
  const roleRows = [...(roles || [])];
  const profileUserIds = profileRows.map((profile) => profile.user_id);
  const missingRoleUserIds = profileUserIds.filter(
    (userId) => !roleRows.some((role) => role.user_id === userId)
  );

  if (missingRoleUserIds.length > 0) {
    const { data: additionalRoles, error: additionalRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .in('user_id', missingRoleUserIds);

    if (additionalRolesError) {
      throw new Error(additionalRolesError.message);
    }

    roleRows.push(...(additionalRoles || []));
  }

  const profileMap = new Map(profileRows.map((profile) => [profile.user_id, profile]));
  const rolesByUser = new Map();
  const latestRoleCreatedAt = new Map();

  roleRows.forEach((roleRow) => {
    if (!rolesByUser.has(roleRow.user_id)) {
      rolesByUser.set(roleRow.user_id, new Set());
    }
    rolesByUser.get(roleRow.user_id).add(roleRow.role);

    const currentLatest = latestRoleCreatedAt.get(roleRow.user_id);
    if (!currentLatest || toTimestamp(roleRow.created_at) > toTimestamp(currentLatest)) {
      latestRoleCreatedAt.set(roleRow.user_id, roleRow.created_at);
    }
  });

  const userIds = new Set();
  profileRows.forEach((profile) => userIds.add(profile.user_id));
  roleRows.forEach((roleRow) => userIds.add(roleRow.user_id));

  let users = Array.from(userIds).map((userId) => {
    const profile = profileMap.get(userId);
    const roleSet = rolesByUser.get(userId);
    const profileCreatedAt = profile?.created_at ?? null;
    const roleCreatedAt = latestRoleCreatedAt.get(userId) ?? null;
    const createdAt =
      toTimestamp(profileCreatedAt) >= toTimestamp(roleCreatedAt)
        ? profileCreatedAt
        : roleCreatedAt;

    return {
      user_id: userId,
      full_name: profile?.full_name ?? null,
      roles: roleSet ? Array.from(roleSet) : [],
      created_at: createdAt,
    };
  });

  users = users.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));

  if (!normalizedSearch) {
    users = users.slice(0, limit);
  }

  return users;
};

app.get('/admin/users-with-roles', async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    const limit = parsePositiveInt(req.query.limit, 5);
    const users = await fetchUsersWithRoles({ searchTerm, limit });
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch users.',
    });
  }
});

app.post('/admin/users/:userId/roles', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    const role = String(req.body?.role || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    if (!APP_ROLES.has(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User already has this role.' });
      }
      throw error;
    }

    return res.status(201).json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add role.',
    });
  }
});

app.delete('/admin/users/:userId/roles/:role', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    const role = String(req.params.role || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    if (!APP_ROLES.has(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      throw error;
    }

    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to remove role.',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/predictions/run', async (req, res) => {
  try {
    const predictionType = normalizePredictionType(req.body?.predictionType || 'hotspot');
    const targetArea = req.body?.targetArea;
    const result = await runPrediction({ predictionType, targetArea });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Prediction failed.' });
  }
});

app.post('/predictions/train-model', async (req, res) => {
  try {
    const targetArea = req.body?.targetArea;
    const { data, error } = await supabase
      .from('crime_data')
      .select('zone_name, latitude, longitude, crime_type, incident_count, risk_score, recorded_date')
      .order('recorded_date', { ascending: false })
      .limit(PREDICTION_LIMIT);

    if (error) {
      throw new Error(`Failed to load crime data: ${error.message}`);
    }

    const crimeRecords = mapCrimeDataToRecords(data || []);
    const filteredRecords = targetArea
      ? crimeRecords.filter((record) =>
          record.policeStation?.toLowerCase().includes(String(targetArea).toLowerCase()) ||
          record.district?.toLowerCase().includes(String(targetArea).toLowerCase())
        )
      : crimeRecords;

    if (filteredRecords.length < 10) {
      return res.status(400).json({ error: 'Not enough records to train pickle model.' });
    }

    const trainingResult = await runPickleTraining(filteredRecords);
    return res.json({
      status: 'ok',
      model: trainingResult.modelId || PICKLE_MODEL_NAME,
      trainedAt: trainingResult.trainedAt,
      recordsUsed: trainingResult.recordsUsed || filteredRecords.length,
      accuracy: trainingResult.accuracy,
      modelPath: PICKLE_MODEL_PATH,
      metadataPath: PICKLE_METADATA_PATH,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Model training failed.',
    });
  }
});

app.post('/alerts/travel-email', async (req, res) => {
  try {
    const {
      to,
      zoneName,
      distanceMeters,
      riskLevel,
      likelyCrimeType,
      probability,
      latitude,
      longitude,
    } = req.body ?? {};

    if (!to || !EMAIL_REGEX.test(String(to))) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    if (!zoneName || !likelyCrimeType) {
      return res.status(400).json({ error: 'Zone name and likely crime type are required.' });
    }

    const lat = parseNumber(latitude);
    const lng = parseNumber(longitude);
    const distance = parseNumber(distanceMeters);
    const risk = Number.isFinite(Number(probability)) ? Number(probability) : 0;

    if (lat === null || lng === null || distance === null) {
      return res.status(400).json({ error: 'Latitude, longitude, and distance are required.' });
    }

    const delivery = await sendTravelAlertEmail({
      to: String(to).trim(),
      zoneName: String(zoneName).trim(),
      distanceMeters: Math.round(distance),
      riskLevel: String(riskLevel || 'high').trim(),
      likelyCrimeType: String(likelyCrimeType).trim(),
      probability: clamp(Math.round(risk), 1, 100),
      latitude: lat,
      longitude: lng,
    });

    if (delivery.status === 'skipped') {
      return res.status(202).json(delivery);
    }

    return res.json(delivery);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Email alert failed.',
    });
  }
});

app.post('/alerts/rebuild', async (_req, res) => {
  try {
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, title, incident_type, severity, location_name, latitude, longitude')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    await loadHotspots();

    for (const incident of incidents || []) {
      await createAlertForIncident(incident);
    }

    res.json({ status: 'ok', processed: incidents?.length || 0 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Alert rebuild failed.' });
  }
});

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Crime backend listening on ${port}`);
  startIncidentWatcher().catch((error) => {
    console.error('Failed to start incident watcher:', error);
  });

  if (process.env.PREDICTION_CRON) {
    cron.schedule(process.env.PREDICTION_CRON, async () => {
      try {
        await runPrediction({ predictionType: 'hotspot' });
        console.log('Scheduled hotspot prediction completed.');
      } catch (error) {
        console.error('Scheduled prediction failed:', error);
      }
    });
  }
});
