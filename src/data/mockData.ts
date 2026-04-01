// Mock data for LokRakshak Crime Prediction Platform

export interface Incident {
  id: string;
  type: string;
  location: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
  status: 'active' | 'investigating' | 'resolved';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  assignedOfficer?: string;
}

export interface CrimeHotspot {
  id: string;
  zone: string;
  coordinates: { lat: number; lng: number };
  riskScore: number;
  predictedCrimes: number;
  crimeTypes: string[];
  timeWindow: string;
}

export interface PatrolSuggestion {
  id: string;
  route: string;
  startTime: string;
  endTime: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  zones: string[];
}

export interface Complaint {
  id: string;
  citizenId: string;
  type: string;
  description: string;
  location: string;
  coordinates: { lat: number; lng: number };
  status: 'pending' | 'in-progress' | 'resolved';
  timestamp: string;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface DashboardStats {
  activeIncidents: number;
  officersOnDuty: number;
  openCases: number;
  evidenceCount: number;
  riotAlertLevel: 'normal' | 'elevated' | 'high' | 'critical';
  predictionAccuracy: number;
}

// Thane city locations for realistic data
const thaneLocations = [
  { name: 'Thane Station Area', lat: 19.1854, lng: 72.9751 },
  { name: 'Ghodbunder Road', lat: 19.2403, lng: 72.9631 },
  { name: 'Majiwada', lat: 19.2167, lng: 72.9778 },
  { name: 'Naupada', lat: 19.1891, lng: 72.9678 },
  { name: 'Hiranandani Estate', lat: 19.2324, lng: 72.9821 },
  { name: 'Wagle Estate', lat: 19.1967, lng: 72.9567 },
  { name: 'Kalwa', lat: 19.2012, lng: 73.0134 },
  { name: 'Mumbra', lat: 19.1734, lng: 73.0245 },
  { name: 'Diva', lat: 19.1856, lng: 73.0312 },
  { name: 'Vartak Nagar', lat: 19.2134, lng: 72.9878 },
  { name: 'Kausa', lat: 19.1712, lng: 73.0306 },
  { name: 'Amrut Nagar', lat: 19.1679, lng: 73.0264 },
  { name: 'Kasarvadavali', lat: 19.2738, lng: 72.9645 },
];

export const zoneCoordinates = Object.fromEntries(
  thaneLocations.map((location) => [location.name, { lat: location.lat, lng: location.lng }])
) as Record<string, { lat: number; lng: number }>;

export const incidents: Incident[] = [
  {
    id: 'INC-2024-001',
    type: 'Theft',
    location: 'Thane Station Area',
    coordinates: thaneLocations[0],
    timestamp: '2024-01-13T14:30:00',
    status: 'active',
    riskLevel: 'high',
    description: 'Chain snatching reported near railway station',
    assignedOfficer: 'SI Rajesh Patil',
  },
  {
    id: 'INC-2024-002',
    type: 'Assault',
    location: 'Mumbra',
    coordinates: thaneLocations[7],
    timestamp: '2024-01-13T12:15:00',
    status: 'investigating',
    riskLevel: 'critical',
    description: 'Physical altercation between two groups',
    assignedOfficer: 'PI Suresh Sharma',
  },
  {
    id: 'INC-2024-003',
    type: 'Burglary',
    location: 'Hiranandani Estate',
    coordinates: thaneLocations[4],
    timestamp: '2024-01-13T09:45:00',
    status: 'active',
    riskLevel: 'medium',
    description: 'Break-in reported at residential complex',
    assignedOfficer: 'ASI Meera Joshi',
  },
  {
    id: 'INC-2024-004',
    type: 'Vandalism',
    location: 'Wagle Estate',
    coordinates: thaneLocations[5],
    timestamp: '2024-01-13T08:00:00',
    status: 'resolved',
    riskLevel: 'low',
    description: 'Property damage to public bus stop',
  },
  {
    id: 'INC-2024-005',
    type: 'Cyber Crime',
    location: 'Majiwada',
    coordinates: thaneLocations[2],
    timestamp: '2024-01-12T16:30:00',
    status: 'investigating',
    riskLevel: 'medium',
    description: 'Online fraud complaint - banking scam',
    assignedOfficer: 'Inspector Vikram Singh',
  },
  {
    id: 'INC-2024-006',
    type: 'Public Disturbance',
    location: 'Ghodbunder Road',
    coordinates: thaneLocations[1],
    timestamp: '2024-01-12T20:00:00',
    status: 'active',
    riskLevel: 'high',
    description: 'Crowd gathering near construction site',
    assignedOfficer: 'SI Anjali Deshmukh',
  },
];

export const crimeHotspots: CrimeHotspot[] = [
  {
    id: 'HS-001',
    zone: 'Thane Station Area',
    coordinates: thaneLocations[0],
    riskScore: 87,
    predictedCrimes: 12,
    crimeTypes: ['Theft', 'Pickpocketing', 'Chain Snatching'],
    timeWindow: '18:00 - 22:00',
  },
  {
    id: 'HS-002',
    zone: 'Mumbra',
    coordinates: thaneLocations[7],
    riskScore: 78,
    predictedCrimes: 8,
    crimeTypes: ['Assault', 'Robbery', 'Public Disturbance'],
    timeWindow: '20:00 - 02:00',
  },
  {
    id: 'HS-003',
    zone: 'Kalwa',
    coordinates: thaneLocations[6],
    riskScore: 65,
    predictedCrimes: 5,
    crimeTypes: ['Burglary', 'Vehicle Theft'],
    timeWindow: '00:00 - 06:00',
  },
  {
    id: 'HS-004',
    zone: 'Naupada',
    coordinates: thaneLocations[3],
    riskScore: 45,
    predictedCrimes: 3,
    crimeTypes: ['Petty Theft', 'Vandalism'],
    timeWindow: '14:00 - 18:00',
  },
];

export const patrolSuggestions: PatrolSuggestion[] = [
  {
    id: 'PS-001',
    route: 'Thane Station → Naupada → Majiwada',
    startTime: '18:00',
    endTime: '22:00',
    priority: 'high',
    reason: 'Peak crime hours in station area',
    zones: ['Thane Station Area', 'Naupada', 'Majiwada'],
  },
  {
    id: 'PS-002',
    route: 'Mumbra Circle → Kausa → Amrut Nagar',
    startTime: '20:00',
    endTime: '02:00',
    priority: 'high',
    reason: 'Recent spike in assault cases',
    zones: ['Mumbra', 'Kausa', 'Amrut Nagar'],
  },
  {
    id: 'PS-003',
    route: 'Ghodbunder Road Patrol',
    startTime: '06:00',
    endTime: '10:00',
    priority: 'medium',
    reason: 'Morning traffic and commuter safety',
    zones: ['Ghodbunder Road', 'Kasarvadavali'],
  },
];

export const complaints: Complaint[] = [
  {
    id: 'CMP-2024-001',
    citizenId: 'CIT-5678',
    type: 'Suspicious Activity',
    description: 'Unknown persons loitering near ATM',
    location: 'Vartak Nagar',
    coordinates: thaneLocations[9],
    status: 'pending',
    timestamp: '2024-01-13T15:00:00',
    riskLevel: 'medium',
  },
  {
    id: 'CMP-2024-002',
    citizenId: 'CIT-1234',
    type: 'Noise Complaint',
    description: 'Loud music from neighboring building',
    location: 'Hiranandani Estate',
    coordinates: thaneLocations[4],
    status: 'in-progress',
    timestamp: '2024-01-13T13:30:00',
    riskLevel: 'low',
  },
  {
    id: 'CMP-2024-003',
    citizenId: 'CIT-9012',
    type: 'Theft Report',
    description: 'Mobile phone stolen from market',
    location: 'Naupada',
    coordinates: thaneLocations[3],
    status: 'in-progress',
    timestamp: '2024-01-13T11:00:00',
    riskLevel: 'medium',
  },
];

export const dashboardStats: DashboardStats = {
  activeIncidents: 24,
  officersOnDuty: 156,
  openCases: 89,
  evidenceCount: 342,
  riotAlertLevel: 'elevated',
  predictionAccuracy: 87.5,
};

export const crimeTrendData = [
  { month: 'Aug', theft: 45, assault: 23, burglary: 12, cyber: 18 },
  { month: 'Sep', theft: 52, assault: 19, burglary: 15, cyber: 22 },
  { month: 'Oct', theft: 38, assault: 28, burglary: 11, cyber: 25 },
  { month: 'Nov', theft: 41, assault: 31, burglary: 18, cyber: 20 },
  { month: 'Dec', theft: 58, assault: 25, burglary: 22, cyber: 28 },
  { month: 'Jan', theft: 35, assault: 21, burglary: 14, cyber: 31 },
];

export const hourlyPrediction = [
  { hour: '00:00', risk: 25 },
  { hour: '02:00', risk: 35 },
  { hour: '04:00', risk: 20 },
  { hour: '06:00', risk: 15 },
  { hour: '08:00', risk: 30 },
  { hour: '10:00', risk: 40 },
  { hour: '12:00', risk: 45 },
  { hour: '14:00', risk: 50 },
  { hour: '16:00', risk: 55 },
  { hour: '18:00', risk: 75 },
  { hour: '20:00', risk: 85 },
  { hour: '22:00', risk: 70 },
];

export const zoneRiskScores = [
  { zone: 'Thane Station', score: 87, change: 12 },
  { zone: 'Mumbra', score: 78, change: 8 },
  { zone: 'Kalwa', score: 65, change: -5 },
  { zone: 'Ghodbunder', score: 52, change: 3 },
  { zone: 'Majiwada', score: 45, change: -2 },
  { zone: 'Naupada', score: 38, change: 0 },
  { zone: 'Hiranandani', score: 25, change: -8 },
  { zone: 'Wagle Estate', score: 32, change: 1 },
];
