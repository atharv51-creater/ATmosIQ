import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// Read existing Pune data
const puneH0 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'zones_h0.geojson'), 'utf8'));
const puneH1 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'zones_h1.geojson'), 'utf8'));
const puneH2 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'zones_h2.geojson'), 'utf8'));
const puneH3 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'zones_h3.geojson'), 'utf8'));
const punePq = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'priority_queue.json'), 'utf8'));
const puneDetails = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'zone_details.json'), 'utf8'));
const puneWind = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wind_latest.json'), 'utf8'));
const puneEmitters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'emitters.json'), 'utf8'));

// Regional Hub definitions across India
const REGIONS = [
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'Delhi / Haryana / UP',
    center: [28.6139, 77.2090],
    basePm25: 185.0,
    pm25Range: [120, 260],
    baseScore: 78.5,
    riskClass: 'Critical',
    populationRange: [180000, 650000],
    cells: [
      { name: 'Anand Vihar', lat: 28.647, lon: 77.315, score: 88.5, pm25: 245.0, pop: 480000, top: ['Interstate bus terminal diesel exhaust (+24)', 'Biomass & waste burning (+18)', 'Thermal inversion trap (+15)'] },
      { name: 'Jahangirpuri', lat: 28.726, lon: 77.168, score: 86.2, pm25: 230.0, pop: 410000, top: ['Industrial metal & scrap processing (+22)', 'Stubble smoke dispersion (+19)', 'High population density (+14)'] },
      { name: 'Wazirpur Industrial', lat: 28.698, lon: 77.165, score: 89.1, pm25: 255.0, pop: 340000, top: ['Metal plating & steel re-rolling (+26)', 'Low wind dispersion (+16)', 'Dense residential proximity (+12)'] },
      { name: 'Okhla Phase-II', lat: 28.530, lon: 77.275, score: 84.0, pm25: 215.0, pop: 390000, top: ['Industrial manufacturing (+20)', 'Heavy freight corridor (+17)', 'Waste-to-energy plant plume (+12)'] },
      { name: 'Bawana Industrial', lat: 28.795, lon: 77.045, score: 87.4, pm25: 240.0, pop: 290000, top: ['Chemical & plastic manufacturing (+25)', 'Industrial furnace emissions (+18)', 'Low planetary boundary layer (+14)'] },
      { name: 'Narela GIDC', lat: 28.845, lon: 77.095, score: 85.3, pm25: 228.0, pop: 260000, top: ['Grain milling & industrial dust (+21)', 'Heavy goods vehicle transit (+17)', 'Agricultural residue drift (+15)'] },
      { name: 'Ghaziabad Sahibabad', lat: 28.670, lon: 77.375, score: 91.2, pm25: 268.0, pop: 540000, top: ['Heavy industrial cluster (+28)', 'Brick kiln upwind corridor (+20)', 'National Highway congestion (+16)'] },
      { name: 'Noida Sector 62', lat: 28.625, lon: 77.365, score: 79.4, pm25: 195.0, pop: 420000, top: ['High-density construction dust (+19)', 'Arterial expressway traffic (+16)', 'Regional haze (+14)'] },
      { name: 'Noida Sector 125', lat: 28.545, lon: 77.335, score: 76.8, pm25: 182.0, pop: 310000, top: ['Expressway transit corridors (+18)', 'Riverbed resuspension dust (+14)', 'Low green buffer (+12)'] },
      { name: 'Faridabad NIT', lat: 28.395, lon: 77.305, score: 83.7, pm25: 218.0, pop: 490000, top: ['Foundry & manufacturing units (+22)', 'Dense urban exposure (+16)', 'Stagnant winter boundary layer (+13)'] },
      { name: 'Gurugram Udyog Vihar', lat: 28.505, lon: 77.085, score: 81.5, pm25: 202.0, pop: 380000, top: ['Diesel generator backup running (+21)', 'NH-48 traffic bottleneck (+18)', 'Paved road dust (+12)'] },
      { name: 'Gurugram Sector 51', lat: 28.435, lon: 77.075, score: 74.2, pm25: 172.0, pop: 280000, top: ['Construction & demolition dust (+18)', 'Vehicular exhaust (+15)', 'Secondary particulate formation (+11)'] },
      { name: 'Dwarka Sector 8', lat: 28.575, lon: 77.065, score: 72.1, pm25: 164.0, pop: 360000, top: ['Airport flight corridor & road traffic (+16)', 'Suburban resuspension (+13)', 'Regional haze (+12)'] },
      { name: 'Rohini Sector 16', lat: 28.735, lon: 77.115, score: 79.8, pm25: 198.0, pop: 450000, top: ['Dense residential biomass heating (+19)', 'Outer Ring Road transit (+17)', 'Low wind dispersion (+13)'] },
      { name: 'Chandni Chowk', lat: 28.655, lon: 77.230, score: 84.6, pm25: 220.0, pop: 510000, top: ['Commercial congestion & slow fleet (+23)', 'Narrow urban street canyon (+20)', 'Dense exposed population (+16)'] }
    ]
  },
  {
    id: 'mumbai',
    name: 'Mumbai MMR',
    state: 'Maharashtra',
    center: [19.0760, 72.8777],
    basePm25: 88.0,
    pm25Range: [55, 145],
    baseScore: 58.2,
    riskClass: 'High',
    populationRange: [250000, 850000],
    cells: [
      { name: 'Chembur East', lat: 19.062, lon: 72.902, score: 76.5, pm25: 128.0, pop: 620000, top: ['Refinery & petrochemical complexes (+24)', 'Thermal power emissions (+18)', 'Harbour freeway traffic (+14)'] },
      { name: 'Kurla West', lat: 19.068, lon: 72.878, score: 78.9, pm25: 135.0, pop: 740000, top: ['LBS Marg dense traffic congestion (+23)', 'Scrap & informal smelting (+17)', 'Extreme population density (+16)'] },
      { name: 'BKC Business District', lat: 19.065, lon: 72.868, score: 68.4, pm25: 104.0, pop: 320000, top: ['Commercial vehicle transit (+19)', 'Metro infrastructure construction (+16)', 'Low tree canopy (+11)'] },
      { name: 'Navi Mumbai MIDC (Mahape)', lat: 19.115, lon: 73.015, score: 74.2, pm25: 122.0, pop: 450000, top: ['Chemical processing & dye units (+22)', 'Thane-Belapur industrial corridor (+18)', 'Freight truck queuing (+13)'] },
      { name: 'Thane Majiwada', lat: 19.215, lon: 72.985, score: 69.8, pm25: 110.0, pop: 530000, top: ['Ghodbunder bottleneck traffic (+21)', 'Heavy transit bypass (+15)', 'Residential construction (+12)'] },
      { name: 'Andheri East (MIDC)', lat: 19.125, lon: 72.865, score: 71.3, pm25: 114.0, pop: 680000, top: ['Western Express Highway exhaust (+20)', 'Light manufacturing & printing (+15)', 'Airport ground emissions (+12)'] },
      { name: 'Dharavi Slum Cluster', lat: 19.040, lon: 72.855, score: 81.2, pm25: 142.0, pop: 850000, top: ['Leather tanneries & pottery kilns (+25)', 'World-record population density (+22)', 'Plastic recycling ovens (+18)'] },
      { name: 'Wadala Truck Terminal', lat: 19.025, lon: 72.875, score: 75.1, pm25: 124.0, pop: 410000, top: ['Heavy diesel trucking hub (+24)', 'Port container movements (+17)', 'Low green cover (+12)'] },
      { name: 'Panvel Industrial', lat: 18.995, lon: 73.115, score: 66.4, pm25: 98.0, pop: 380000, top: ['Expressway interchange fumes (+18)', 'Taloja chemical zone drift (+16)', 'High regional growth (+11)'] },
      { name: 'Kalyan-Dombivli MIDC', lat: 19.225, lon: 73.135, score: 77.4, pm25: 130.0, pop: 590000, top: ['Chemical effluent evaporation (+23)', 'Rail yard diesel idling (+16)', 'Rapid urban expansion (+13)'] },
      { name: 'Borivali Link Road', lat: 19.230, lon: 72.845, score: 55.3, pm25: 78.0, pop: 480000, top: ['Coastal sea breeze dispersion (+15)', 'Link Road traffic (+14)', 'National Park buffer benefit (-10)'] },
      { name: 'Worli Seaface', lat: 19.015, lon: 72.815, score: 48.7, pm25: 64.0, pop: 310000, top: ['Coastal wind dispersion (+16)', 'Coastal Road traffic (+13)', 'High sea salt aerosol (+8)'] }
    ]
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru Urban',
    state: 'Karnataka',
    center: [12.9716, 77.5946],
    basePm25: 52.0,
    pm25Range: [30, 95],
    baseScore: 46.5,
    riskClass: 'Moderate',
    populationRange: [180000, 520000],
    cells: [
      { name: 'Peenya Industrial Area', lat: 13.030, lon: 77.520, score: 76.8, pm25: 112.0, pop: 440000, top: ['Asia largest MSME industrial hub (+25)', 'Metal fabricating & machine shops (+18)', 'Tumkur Road heavy freight (+16)'] },
      { name: 'Whitefield IT & Export Zone', lat: 12.975, lon: 77.745, score: 64.2, pm25: 84.0, pop: 390000, top: ['Heavy construction & road dust (+20)', 'IT tech corridor commuter jam (+17)', 'Diesel generator clusters (+13)'] },
      { name: 'Central Silk Board', lat: 12.918, lon: 77.624, score: 74.5, pm25: 106.0, pop: 480000, top: ['Chronic arterial vehicular idling (+26)', 'Hosur road freight corridor (+19)', 'Resuspended fine silt (+14)'] },
      { name: 'BTM Layout Phase 2', lat: 12.915, lon: 77.605, score: 58.4, pm25: 74.0, pop: 410000, top: ['Outer Ring Road spillover (+18)', 'Dense residential exposure (+14)', 'Moderate urban tree cover (-6)'] },
      { name: 'Hebbal Flyover Junction', lat: 13.038, lon: 77.592, score: 68.1, pm25: 92.0, pop: 370000, top: ['Airport highway transit bottleneck (+22)', 'Construction of transit flyovers (+16)', 'Flyover shadow thermal gradient (+11)'] },
      { name: 'Electronic City Phase 1', lat: 12.845, lon: 77.665, score: 59.3, pm25: 76.0, pop: 320000, top: ['Elevated expressway transit (+17)', 'Hardware & manufacturing units (+14)', 'Suburban development dust (+12)'] },
      { name: 'Rajajinagar Industrial', lat: 12.990, lon: 77.555, score: 66.8, pm25: 88.0, pop: 460000, top: ['Small-scale fabrication units (+19)', 'High urban density (+16)', 'Old diesel bus depot (+13)'] },
      { name: 'Koramangala 80ft Road', lat: 12.935, lon: 77.625, score: 54.2, pm25: 68.0, pop: 350000, top: ['Urban commercial vehicular traffic (+17)', 'High population vulnerability (+12)', 'Good avenue tree cover (-8)'] },
      { name: 'Jayanagar 4th Block', lat: 12.925, lon: 77.585, score: 42.1, pm25: 48.0, pop: 290000, top: ['Mature garden city tree canopy (-14)', 'Moderate localized traffic (+12)', 'Low industrial presence (-10)'] },
      { name: 'Bannerghatta Road Corridor', lat: 12.895, lon: 77.595, score: 61.5, pm25: 80.0, pop: 380000, top: ['Narrow corridor traffic congestion (+19)', 'Quarrying activities nearby (+14)', 'Rapid high-rise development (+12)'] }
    ]
  },
  {
    id: 'kolkata',
    name: 'Kolkata Metropolitan',
    state: 'West Bengal',
    center: [22.5726, 88.3639],
    basePm25: 110.0,
    pm25Range: [65, 175],
    baseScore: 66.5,
    riskClass: 'High',
    populationRange: [320000, 920000],
    cells: [
      { name: 'Howrah Railway & Port', lat: 22.585, lon: 88.342, score: 83.4, pm25: 168.0, pop: 820000, top: ['Railway diesel locomotives & coal freight (+24)', 'Heavy commercial truck entry (+20)', 'Extreme population density (+18)'] },
      { name: 'Rabindra Bharati / BT Road', lat: 22.625, lon: 88.380, score: 81.2, pm25: 158.0, pop: 690000, top: ['BT Road heavy transit congestion (+23)', 'North Kolkata industrial foundry strip (+19)', 'Riverine humidity trapping particulates (+14)'] },
      { name: 'Taratala Industrial Area', lat: 22.505, lon: 88.305, score: 79.5, pm25: 152.0, pop: 540000, top: ['Heavy engineering & casting units (+22)', 'Port transport vehicular emissions (+18)', 'Low tree canopy (+12)'] },
      { name: 'Victoria Memorial / Maidan', lat: 22.545, lon: 88.342, score: 62.1, pm25: 98.0, pop: 310000, top: ['City center thoroughfare traffic (+19)', 'Large open park buffer (-15)', 'Winter temperature inversion (+13)'] },
      { name: 'Salt Lake Sector V', lat: 22.575, lon: 88.435, score: 65.4, pm25: 104.0, pop: 420000, top: ['IT commuter vehicle influx (+18)', 'Wetland proximity benefits (-8)', 'Construction of bypasses (+14)'] },
      { name: 'Jadavpur University Zone', lat: 22.495, lon: 88.370, score: 67.2, pm25: 112.0, pop: 580000, top: ['High residential population density (+18)', 'Auto-rickshaw and bus fleets (+16)', 'Biomass cooking in informal settlements (+13)'] },
      { name: 'Asansol Industrial Basin', lat: 23.685, lon: 86.975, score: 87.2, pm25: 210.0, pop: 480000, top: ['Open-cast coal mining dust (+27)', 'Steel plants & sponge iron units (+24)', 'Valley particulate trap (+16)'] },
      { name: 'Durgapur Steel City', lat: 23.520, lon: 87.310, score: 85.1, pm25: 198.0, pop: 430000, top: ['Integrated steel plant emissions (+26)', 'Thermal power generation (+21)', 'Heavy coal trucking corridor (+17)'] }
    ]
  },
  {
    id: 'gangetic',
    name: 'Indo-Gangetic Basin',
    state: 'Uttar Pradesh / Bihar',
    center: [26.2000, 81.8000],
    basePm25: 155.0,
    pm25Range: [95, 230],
    baseScore: 76.0,
    riskClass: 'Critical',
    populationRange: [280000, 750000],
    cells: [
      { name: 'Kanpur Jajmau Industrial', lat: 26.435, lon: 80.395, score: 89.4, pm25: 235.0, pop: 640000, top: ['Leather tanneries & chemical boilers (+27)', 'Heavy coal and biomass combustion (+21)', 'Stagnant Gangetic air basin (+18)'] },
      { name: 'Kanpur Kalyanpur', lat: 26.495, lon: 80.265, score: 82.5, pm25: 198.0, pop: 510000, top: ['GT Road freight corridor (+22)', 'Unpaved road silt (+18)', 'Brick kiln upwind plumes (+16)'] },
      { name: 'Lucknow Charbagh Railway', lat: 26.830, lon: 80.920, score: 84.8, pm25: 215.0, pop: 590000, top: ['Massive transit hub vehicular idling (+24)', 'Central city canyon trapping smoke (+20)', 'Extremely dense exposure (+17)'] },
      { name: 'Lucknow Talkatora MIDC', lat: 26.825, lon: 80.885, score: 86.1, pm25: 224.0, pop: 480000, top: ['Industrial manufacturing & foundries (+25)', 'Waste dumping & open burning (+19)', 'Low boundary layer inversion (+16)'] },
      { name: 'Lucknow Gomti Nagar', lat: 26.855, lon: 81.005, score: 69.4, pm25: 145.0, pop: 420000, top: ['Rapid suburban expansion dust (+18)', 'Expressway vehicular corridors (+15)', 'Winter smoke pool (+14)'] },
      { name: 'Patna Danapur Cantonment', lat: 25.635, lon: 85.045, score: 85.4, pm25: 220.0, pop: 520000, top: ['Gangetic alluvium fine sand resuspension (+25)', 'Dense brick kilns in peri-urban belt (+22)', 'High vehicular tailpipe fumes (+17)'] },
      { name: 'Patna City (Old Town)', lat: 25.605, lon: 85.185, score: 88.2, pm25: 232.0, pop: 690000, top: ['Narrow lanes with high vehicle density (+24)', 'Unpaved soil dust (+20)', 'High population vulnerability (+18)'] },
      { name: 'Varanasi Bhelupur', lat: 25.295, lon: 82.995, score: 81.6, pm25: 195.0, pop: 490000, top: ['High urban density & domestic cooking (+21)', 'Heavy two-wheeler & auto fleet (+18)', 'River valley temperature inversion (+15)'] },
      { name: 'Agra Taj Trapezium Zone', lat: 27.175, lon: 78.042, score: 79.2, pm25: 184.0, pop: 430000, top: ['Highway transit across NH-19 (+21)', 'Fine alluvium dust (+17)', 'Secondary aerosol formation (+14)'] }
    ]
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad Cyberabad',
    state: 'Telangana',
    center: [17.3850, 78.4867],
    basePm25: 64.0,
    pm25Range: [38, 115],
    baseScore: 52.4,
    riskClass: 'Moderate',
    populationRange: [210000, 610000],
    cells: [
      { name: 'Sanathnagar Industrial Area', lat: 17.455, lon: 78.440, score: 78.4, pm25: 125.0, pop: 490000, top: ['Bulk drug & chemical manufacturing (+24)', 'Heavy goods vehicle transit (+18)', 'Dense worker colonies (+15)'] },
      { name: 'Cherlapally Industrial Estate', lat: 17.475, lon: 78.605, score: 75.1, pm25: 118.0, pop: 380000, top: ['Plastics & electrical industries (+22)', 'Railway goods terminal dust (+16)', 'Low vegetative canopy (+13)'] },
      { name: 'HITEC City Tech Corridor', lat: 17.445, lon: 78.375, score: 58.7, pm25: 75.0, pop: 420000, top: ['High commuter vehicular influx (+19)', 'Continuous high-rise construction (+16)', 'Diesel generator emissions (+12)'] },
      { name: 'Charminar Heritage Core', lat: 17.360, lon: 78.475, score: 72.3, pm25: 108.0, pop: 610000, top: ['Extreme congestion in narrow bazaars (+23)', 'Old auto-rickshaws & two-wheelers (+19)', 'Very dense resident population (+16)'] },
      { name: 'Pashamylaram Pharma SEZ', lat: 17.535, lon: 78.185, score: 81.2, pm25: 132.0, pop: 290000, top: ['Active pharmaceutical ingredient reactors (+26)', 'Boiler emissions & VOCs (+21)', 'Heavy chemical tanker traffic (+15)'] },
      { name: 'Secunderabad Paradise Junction', lat: 17.440, lon: 78.490, score: 66.5, pm25: 92.0, pop: 510000, top: ['Commercial transit hub traffic (+20)', 'Bus terminal idling (+16)', 'Dense urban fabric (+14)'] }
    ]
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad - Gujarat Industrial',
    state: 'Gujarat',
    center: [22.7000, 72.7500],
    basePm25: 98.0,
    pm25Range: [60, 160],
    baseScore: 65.8,
    riskClass: 'High',
    populationRange: [240000, 680000],
    cells: [
      { name: 'Vatva GIDC Phase-IV', lat: 22.955, lon: 72.635, score: 86.4, pm25: 172.0, pop: 480000, top: ['Chemical & dye manufacturing (+26)', 'Industrial solid waste burning (+19)', 'Heavy chemical tanker movements (+15)'] },
      { name: 'Narol Textile Processing Zone', lat: 22.975, lon: 72.585, score: 84.8, pm25: 165.0, pop: 540000, top: ['Textile dyeing coal-fired boilers (+25)', 'Dense worker neighborhoods (+18)', 'Low chimney dispersion (+14)'] },
      { name: 'Maninagar East', lat: 22.995, lon: 72.610, score: 73.2, pm25: 124.0, pop: 580000, top: ['Downwind industrial smoke drift (+21)', 'Arterial road traffic congestion (+17)', 'High population vulnerability (+15)'] },
      { name: 'Surat Pandesara GIDC', lat: 21.145, lon: 72.825, score: 85.2, pm25: 168.0, pop: 640000, top: ['Textile processing cluster emissions (+26)', 'Lignite boiler burning (+20)', 'Extreme population density (+18)'] },
      { name: 'Ankleshwar Chemical Hub', lat: 21.625, lon: 73.015, score: 89.5, pm25: 185.0, pop: 310000, top: ['Critical chemical industry cluster (+28)', 'Petrochemical & pesticide synthesis (+23)', 'Volatile organic compound haze (+17)'] }
    ]
  }
];

// Hexagon coordinate builder from centroid
function makeHexPolygon(lat, lon, radius = 0.016) {
  const coords = [];
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * i;
    // Account for latitude shrinkage in longitude
    const dLat = (radius * Math.sin(angle));
    const dLon = (radius * Math.cos(angle)) / Math.cos(lat * (Math.PI / 180));
    coords.push([Number((lon + dLon).toFixed(6)), Number((lat + dLat).toFixed(6))]);
  }
  return [coords];
}

function classifyRisk(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

function getWindCardinal(degrees) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return cardinals[index];
}

function calculateWeatherForRegion(regId, windSpeed, windDir) {
  let baseTemp = 26;
  let baseHumidity = 55;
  let basePblh = 700;
  let basePressure = 1013;

  if (regId === 'delhi') {
    baseTemp = 21.5;
    baseHumidity = 68;
    basePblh = 390; // shallow winter boundary layer
    basePressure = 1016;
  } else if (regId === 'mumbai') {
    baseTemp = 29.2;
    baseHumidity = 74; // marine coastal moisture
    basePblh = 820;
    basePressure = 1012;
  } else if (regId === 'bengaluru') {
    baseTemp = 23.4;
    baseHumidity = 58;
    basePblh = 940; // high elevation mixing
    basePressure = 915; // 920m ASL
  } else if (regId === 'kolkata') {
    baseTemp = 25.0;
    baseHumidity = 78; // riverine moisture
    basePblh = 510;
    basePressure = 1014;
  } else if (regId === 'gangetic') {
    baseTemp = 22.0;
    baseHumidity = 72;
    basePblh = 410; // basin inversion trap
    basePressure = 1015;
  } else if (regId === 'hyderabad') {
    baseTemp = 27.2;
    baseHumidity = 50;
    basePblh = 780;
    basePressure = 960;
  } else if (regId === 'ahmedabad') {
    baseTemp = 28.5;
    baseHumidity = 42;
    basePblh = 760;
    basePressure = 1011;
  } else {
    // Pune
    baseTemp = 25.5;
    baseHumidity = 52;
    basePblh = 680;
    basePressure = 955;
  }

  const temp = Number((baseTemp + (Math.random() * 2 - 1)).toFixed(1));
  const humidity = Math.min(95, Math.max(30, Math.round(baseHumidity + (Math.random() * 6 - 3))));
  const pblh = Math.round(basePblh + (Math.random() * 50 - 25));
  const ventilation = Math.round(windSpeed * pblh);
  const kmh = Number((windSpeed * 3.6).toFixed(1));
  const gustsKmh = Number((kmh * (1.35 + Math.random() * 0.25)).toFixed(1));

  let dispersionCategory = 'Moderate Dispersion';
  let inversionStatus = 'Weak Inversion';
  let stagnationIndex = 45;

  if (ventilation < 2000) {
    dispersionCategory = 'Severe Stagnation';
    inversionStatus = 'Strong Surface Inversion Active';
    stagnationIndex = Math.round(75 + Math.random() * 20);
  } else if (ventilation > 5500) {
    dispersionCategory = 'Favorable Dispersion';
    inversionStatus = 'Well-Mixed Boundary Layer';
    stagnationIndex = Math.round(15 + Math.random() * 15);
  } else {
    stagnationIndex = Math.round(40 + Math.random() * 25);
  }

  return {
    wind_speed_kmh: kmh,
    wind_gusts_kmh: gustsKmh,
    wind_cardinal: getWindCardinal(windDir),
    temperature_c: temp,
    feels_like_c: Number((temp + (humidity > 60 ? 1.5 : -0.5)).toFixed(1)),
    humidity_pct: humidity,
    pressure_hpa: basePressure,
    boundary_layer_height: pblh,
    ventilation_coefficient: ventilation,
    dispersion_category: dispersionCategory,
    inversion_status: inversionStatus,
    air_stagnation_index: stagnationIndex
  };
}

console.log('Generating Pan-India Dataset with Enriched Weather...');

const allFeaturesH0 = [...puneH0.features];
const allFeaturesH1 = [...puneH1.features];
const allFeaturesH2 = [...puneH2.features];
const allFeaturesH3 = [...puneH3.features];
const allPq = [...punePq];
const allDetails = { ...puneDetails };
const allEmitters = [...puneEmitters];

// Enrich existing Pune wind cells with rich meteorological attributes
const allWind = puneWind.map((pw, i) => {
  const wSpd = Number(pw.wind_speed.toFixed(2));
  const wDir = Number(pw.wind_dir.toFixed(1));
  const weather = calculateWeatherForRegion('pune', wSpd, wDir);
  return {
    ...pw,
    name: `Pune Sector ${i + 1}`,
    region: 'pune',
    region_name: 'Pune Metro',
    ...weather
  };
});

// Add regional tags to existing Pune cells
allFeaturesH0.forEach(f => { f.properties.region = 'pune'; f.properties.region_name = 'Pune Metro'; });
allFeaturesH1.forEach(f => { f.properties.region = 'pune'; f.properties.region_name = 'Pune Metro'; });
allFeaturesH2.forEach(f => { f.properties.region = 'pune'; f.properties.region_name = 'Pune Metro'; });
allFeaturesH3.forEach(f => { f.properties.region = 'pune'; f.properties.region_name = 'Pune Metro'; });
allPq.forEach(p => { p.region = 'pune'; p.region_name = 'Pune Metro'; });

let newCellCount = 0;

REGIONS.forEach((reg) => {
  reg.cells.forEach((cell, idx) => {
    newCellCount++;
    const cellId = `in_${reg.id}_${String(idx + 1).padStart(3, '0')}`;
    const hexCoords = makeHexPolygon(cell.lat, cell.lon);

    // Weather / wind vector for cell
    const windSpeed = Number((1.5 + Math.random() * 2.5).toFixed(2));
    const windDir = reg.id === 'delhi' ? 315 : reg.id === 'mumbai' ? 250 : reg.id === 'bengaluru' ? 80 : reg.id === 'kolkata' ? 340 : reg.id === 'gangetic' ? 300 : reg.id === 'hyderabad' ? 120 : reg.id === 'ahmedabad' ? 260 : 280;
    const rad = (windDir * Math.PI) / 180;
    const windU = Number((-windSpeed * Math.sin(rad)).toFixed(3));
    const windV = Number((-windSpeed * Math.cos(rad)).toFixed(3));
    const weather = calculateWeatherForRegion(reg.id, windSpeed, windDir);

    allWind.push({
      cell_id: cellId,
      name: `${cell.name} (${reg.name})`,
      lat: cell.lat,
      lon: cell.lon,
      wind_u: windU,
      wind_v: windV,
      wind_speed: windSpeed,
      wind_dir: windDir,
      region: reg.id,
      region_name: reg.name,
      ...weather
    });

    // Forecast variation across horizons
    const scores = {
      0: cell.score,
      1: Number((cell.score + (Math.random() * 4 - 1.5)).toFixed(1)),
      2: Number((cell.score + (Math.random() * 6 - 2.0)).toFixed(1)),
      3: Number((cell.score + (Math.random() * 8 - 2.5)).toFixed(1))
    };

    const pm25s = {
      0: cell.pm25,
      1: Number((cell.pm25 + (Math.random() * 12 - 4)).toFixed(1)),
      2: Number((cell.pm25 + (Math.random() * 16 - 5)).toFixed(1)),
      3: Number((cell.pm25 + (Math.random() * 20 - 6)).toFixed(1))
    };

    // Calculate hazard, exposure, vulnerability
    const hazard = Number((Math.min(1.0, cell.pm25 / 220)).toFixed(3));
    const exposure = Number((Math.min(1.0, cell.pop / 700000)).toFixed(3));
    const vulnerability = Number((0.68 + Math.random() * 0.22).toFixed(3));
    const aqiEst = Math.min(500, Math.round(cell.pm25 * 1.65));

    // Priority item
    allPq.push({
      cell_id: cellId,
      name: `${cell.name} (${reg.name})`,
      lat: cell.lat,
      lon: cell.lon,
      pop: cell.pop,
      industry_frac: Number((0.15 + Math.random() * 0.4).toFixed(3)),
      emit_5km: Math.floor(2 + Math.random() * 8),
      top_factors: cell.top,
      score_now: scores[0],
      score_h1: scores[1],
      score_h2: scores[2],
      score_h3: scores[3],
      score_ranked: scores[0],
      trend: Number((scores[3] - scores[0]).toFixed(1)),
      risk_class: classifyRisk(scores[0]),
      action: scores[0] >= 75
        ? 'Emergency Action: Mobile air purifier deployment, enforce GRAP Phase-IV construction curbs, health advisory'
        : scores[0] >= 50
        ? 'Targeted Intervention: Heavy vehicle diversions, mechanized dust sweeping, monitor industrial boilers'
        : 'Continuous Monitoring: Routine telemetry, public awareness, green buffer expansion',
      priority_raw: scores[0] * cell.pop,
      region: reg.id,
      region_name: reg.name
    });

    // 4 GeoJSON horizons
    [0, 1, 2, 3].forEach(h => {
      const feat = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: hexCoords
        },
        properties: {
          cell_id: cellId,
          name: `${cell.name} (${reg.name})`,
          horizon_days: h,
          date: '2026-11-06',
          score: scores[h],
          risk_class: classifyRisk(scores[h]),
          hazard,
          exposure,
          vulnerability,
          pm25: pm25s[h],
          aqi_est: Math.min(500, Math.round(pm25s[h] * 1.65)),
          population: cell.pop,
          top_factors: cell.top,
          forecast_drivers: [
            `today's PM2.5 (+${(cell.pm25 * 0.12).toFixed(1)} ug/m3)`,
            `regional atmospheric stagnation (+${(1.5 + Math.random() * 2).toFixed(1)} ug/m3)`,
            `wind transport from upwind corridors (+${(1.0 + Math.random() * 2).toFixed(1)} ug/m3)`
          ],
          region: reg.id,
          region_name: reg.name
        }
      };

      if (h === 0) allFeaturesH0.push(feat);
      if (h === 1) allFeaturesH1.push(feat);
      if (h === 2) allFeaturesH2.push(feat);
      if (h === 3) allFeaturesH3.push(feat);
    });

    // Zone Details
    allDetails[cellId] = {
      cell_id: cellId,
      name: `${cell.name} (${reg.name})`,
      region: reg.id,
      region_name: reg.name,
      state: reg.state,
      scores,
      components: {
        hazard,
        exposure,
        vulnerability
      },
      points: {
        pts_pollution: Math.round(scores[0] * 0.45),
        pts_emission: Math.round(scores[0] * 0.25),
        pts_population: Math.round(scores[0] * 0.20),
        pts_wind: Math.round(scores[0] * 0.10)
      },
      top_factors: cell.top,
      forecast_drivers: [
        { feature: 'pm25_lag0', label: 'Local PM2.5 baseline', value: cell.pm25, shap: 14.5, text: `Direct local emission concentration (~${cell.pm25} µg/m³)` },
        { feature: 'boundary_layer', label: 'Planetary Boundary Layer', value: 380, shap: 11.2, text: 'Low inversion ceiling trapping particulates near ground level' },
        { feature: 'population_density', label: 'Census Population Weight', value: cell.pop, shap: 9.8, text: `High residential exposure (${cell.pop.toLocaleString()} citizens)` }
      ],
      history: {
        dates: ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
        pm25: [
          Math.round(cell.pm25 * 0.85),
          Math.round(cell.pm25 * 0.90),
          Math.round(cell.pm25 * 0.88),
          Math.round(cell.pm25 * 0.95),
          Math.round(cell.pm25 * 1.02),
          Math.round(cell.pm25 * 0.98),
          cell.pm25
        ],
        forecast_dates: ['2026-11-07', '2026-11-08', '2026-11-09'],
        forecast_pm25: [pm25s[1], pm25s[2], pm25s[3]]
      }
    };
  });
});

// Re-rank Pan-India Priority Queue
allPq.sort((a, b) => b.priority_raw - a.priority_raw);
const topRaw = allPq[0]?.priority_raw || 1;
allPq.forEach((item, idx) => {
  item.rank = idx + 1;
  item.priority_index = Math.round((item.priority_raw / topRaw) * 100);
});

// Add major Pan-India industrial emitters
const panIndiaEmitters = [
  ...puneEmitters,
  [28.670, 77.375, 1.0], // Sahibabad
  [28.795, 77.045, 0.95], // Bawana
  [28.530, 77.275, 0.9], // Okhla
  [19.062, 72.902, 1.0], // Chembur refineries
  [19.115, 73.015, 0.95], // Navi Mumbai MIDC
  [19.225, 73.135, 0.9], // Dombivli
  [13.030, 77.520, 0.85], // Peenya
  [22.585, 88.342, 0.9], // Howrah
  [23.520, 87.310, 1.0], // Durgapur Steel
  [23.685, 86.975, 1.0], // Asansol
  [26.435, 80.395, 0.95], // Kanpur Jajmau
  [26.825, 80.885, 0.85], // Lucknow Talkatora
  [17.455, 78.440, 0.9], // Hyderabad Sanathnagar
  [17.535, 78.185, 0.95], // Pashamylaram
  [22.955, 72.635, 1.0], // Vatva GIDC
  [21.145, 72.825, 0.95], // Surat Pandesara
  [21.625, 73.015, 1.0]  // Ankleshwar
];

// Write Pan-India Datasets
fs.writeFileSync(path.join(DATA_DIR, 'india_zones_h0.geojson'), JSON.stringify({ type: 'FeatureCollection', features: allFeaturesH0 }));
fs.writeFileSync(path.join(DATA_DIR, 'india_zones_h1.geojson'), JSON.stringify({ type: 'FeatureCollection', features: allFeaturesH1 }));
fs.writeFileSync(path.join(DATA_DIR, 'india_zones_h2.geojson'), JSON.stringify({ type: 'FeatureCollection', features: allFeaturesH2 }));
fs.writeFileSync(path.join(DATA_DIR, 'india_zones_h3.geojson'), JSON.stringify({ type: 'FeatureCollection', features: allFeaturesH3 }));
fs.writeFileSync(path.join(DATA_DIR, 'india_priority_queue.json'), JSON.stringify(allPq, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'india_zone_details.json'), JSON.stringify(allDetails, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'india_wind_latest.json'), JSON.stringify(allWind, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'india_emitters.json'), JSON.stringify(panIndiaEmitters, null, 2));

// National Pan-India Summary
const classCounts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
let totalScore = 0;
let totalPopExposed = 0;

allFeaturesH0.forEach(f => {
  const p = f.properties;
  classCounts[p.risk_class] = (classCounts[p.risk_class] || 0) + 1;
  totalScore += p.score;
  if (p.risk_class === 'High' || p.risk_class === 'Critical') {
    totalPopExposed += (p.population || 0);
  }
});

const indiaSummary = {
  city: "India National Environmental Cadastre",
  data_date: "2026-11-06",
  weights: { hazard: 0.5, exposure: 0.3, vulnerability: 0.2 },
  class_counts_now: classCounts,
  mean_score_now: Number((totalScore / allFeaturesH0.length).toFixed(1)),
  mean_score_h3: Number((totalScore / allFeaturesH0.length - 0.4).toFixed(1)),
  population_in_high_or_critical: totalPopExposed,
  total_cells: allFeaturesH0.length,
  regions_covered: [
    'Pune Metro',
    'Delhi NCR',
    'Mumbai MMR',
    'Bengaluru Urban',
    'Kolkata Metropolitan',
    'Indo-Gangetic Basin',
    'Hyderabad Cyberabad',
    'Ahmedabad-Gujarat Industrial'
  ]
};

fs.writeFileSync(path.join(DATA_DIR, 'india_summary.json'), JSON.stringify(indiaSummary, null, 2));

// Generate Synoptic Weather Report for All India and Regions
const REGION_IDS = ['all', 'delhi', 'mumbai', 'pune', 'bengaluru', 'kolkata', 'gangetic', 'hyderabad', 'ahmedabad'];
const synopticWeatherReports = {};

REGION_IDS.forEach((rId) => {
  const isAll = rId === 'all';
  const regCells = isAll ? allWind : allWind.filter(w => w.region === rId);
  const n = regCells.length || 1;

  const avgSpeed = Number((regCells.reduce((a, b) => a + (b.wind_speed || 0), 0) / n).toFixed(2));
  const avgKmh = Number((avgSpeed * 3.6).toFixed(1));
  const maxGust = Number((Math.max(...regCells.map(c => c.wind_gusts_kmh || 0), avgKmh * 1.4)).toFixed(1));
  const avgTemp = Number((regCells.reduce((a, b) => a + (b.temperature_c || 25), 0) / n).toFixed(1));
  const avgHum = Math.round(regCells.reduce((a, b) => a + (b.humidity_pct || 55), 0) / n);
  const avgPblh = Math.round(regCells.reduce((a, b) => a + (b.boundary_layer_height || 600), 0) / n);
  const avgVent = Math.round(avgSpeed * avgPblh);
  const avgStagnation = Math.round(regCells.reduce((a, b) => a + (b.air_stagnation_index || 40), 0) / n);
  const avgDir = isAll ? 300 : (regCells[0]?.wind_dir || 280);
  const cardinal = getWindCardinal(avgDir);

  let synopticText = '';
  let trajectoryText = '';
  if (rId === 'delhi') {
    synopticText = 'Persistent continental north-westerly flow with an intensely compressed planetary boundary layer (390 m) causing nocturnal thermal inversion traps and high stagnation.';
    trajectoryText = 'Plumes traversing north-westerly agricultural & industrial corridors (Punjab / Haryana / Panipat) entering Rohini & Anand Vihar.';
  } else if (rId === 'mumbai') {
    synopticText = 'Diurnal land-sea breeze oscillation with high marine humidity (74%). Morning calm transitions into moderate westerly sea breeze dispersing coastal corridors.';
    trajectoryText = 'Refinery and petrochemical emissions from Chembur & Taloja drifting north-eastward over Navi Mumbai & Thane basin.';
  } else if (rId === 'bengaluru') {
    synopticText = 'Elevated Deccan plateau breeze with a well-developed vertical mixing layer (940 m) providing favorable aerodynamic dispersion.';
    trajectoryText = 'Easterly convective breezes channeling industrial emissions from Peenya and Hosur road into suburban fringes.';
  } else if (rId === 'kolkata') {
    synopticText = 'Calm riverine moisture boundary layer with dense morning haze. Particulates trapped under low winter inversion ceiling (510 m).';
    trajectoryText = 'Coal transit & industrial foundry plumes from Howrah & Asansol drifting along Hooghly river valley.';
  } else if (rId === 'gangetic') {
    synopticText = 'Extensive Indo-Gangetic valley air stagnation. Calm surface winds (<6 km/h) and low boundary layer creating a basin-wide particulate containment zone.';
    trajectoryText = 'Regional agricultural biomass and industrial stack effluents pooling across the low-elevation alluvial plain.';
  } else if (rId === 'pune') {
    synopticText = 'North-easterly to westerly valley breeze across the Mula-Mutha basin. Moderate boundary layer height (680 m) with evening temperature inversions.';
    trajectoryText = 'Automotive & industrial emissions from Bhosari-PCMC corridor transported toward central Pune during calm evening hours.';
  } else if (rId === 'hyderabad') {
    synopticText = 'Moderate south-easterly Deccan breeze with dry continental conditions. Moderate vertical mixing depth (780 m).';
    trajectoryText = 'Bulk drug and pharmaceutical emissions from Sanathnagar & Pashamylaram dispersing along the ring road corridor.';
  } else if (rId === 'ahmedabad') {
    synopticText = 'Dry westerly Gulf breezes with strong thermal buoyancy during peak hours. High particulate resuspension potential.';
    trajectoryText = 'Chemical dye and textile emissions from Vatva GIDC and Narol industrial belt carried toward eastern residential sectors.';
  } else {
    synopticText = 'Pan-India composite synoptic pattern: high stagnation over northern plains, moderate maritime dispersion along western & southern coastal belts.';
    trajectoryText = 'Inter-state air mass exchanges predominantly flowing northwest-to-southeast across the Indo-Gangetic conveyor.';
  }

  // 16-point wind rose
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const windRose = cardinals.map((c, idx) => {
    const angle = idx * 22.5;
    const diff = Math.abs((angle - avgDir + 180) % 360 - 180);
    const weight = Math.max(0.04, Math.exp(-Math.pow(diff / 45, 2)));
    return {
      cardinal: c,
      angle,
      frequency_pct: Number((weight * 32).toFixed(1)),
      avg_speed_kmh: Number((avgKmh * (0.8 + weight * 0.4)).toFixed(1))
    };
  });
  // Normalize frequencies to sum ~ 100
  const sumFreq = windRose.reduce((a, b) => a + b.frequency_pct, 0) || 1;
  windRose.forEach(wr => wr.frequency_pct = Number(((wr.frequency_pct / sumFreq) * 100).toFixed(1)));

  // 24-Hour hourly forecast
  const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  const hourly24h = hours.map((h, i) => {
    // Diurnal cycle: calm at night, higher wind and mixing layer in midday
    const isDay = i >= 4 && i <= 8;
    const speedMult = isDay ? 1.35 : 0.72;
    const pblhMult = isDay ? 1.45 : 0.65;
    const tempOffset = isDay ? 3.5 : -4.0;
    const hSpeed = Number((avgKmh * speedMult).toFixed(1));
    const hPblh = Math.round(avgPblh * pblhMult);
    const hVent = Math.round((hSpeed / 3.6) * hPblh);

    return {
      hour: h,
      wind_speed_kmh: hSpeed,
      wind_gusts_kmh: Number((hSpeed * 1.4).toFixed(1)),
      temperature_c: Number((avgTemp + tempOffset).toFixed(1)),
      relative_humidity_pct: Math.min(95, Math.round(avgHum + (isDay ? -12 : 14))),
      boundary_layer_height_m: hPblh,
      ventilation_index: hVent,
      dispersion_quality: hVent < 2000 ? 'Severe Stagnation' : hVent < 5500 ? 'Moderate' : 'Good'
    };
  });

  synopticWeatherReports[rId] = {
    region_id: rId,
    region_name: isAll ? 'All India National Grid' : (regCells[0]?.region_name || rId.toUpperCase()),
    data_date: '2026-11-06',
    current: {
      wind_speed_kmh: avgKmh,
      wind_speed_ms: avgSpeed,
      wind_gusts_kmh: maxGust,
      wind_dir: avgDir,
      wind_cardinal: cardinal,
      temperature_c: avgTemp,
      feels_like_c: Number((avgTemp + (avgHum > 60 ? 1.5 : -0.5)).toFixed(1)),
      humidity_pct: avgHum,
      pressure_hpa: isAll ? 1013 : (regCells[0]?.pressure_hpa || 1013),
      boundary_layer_height_m: avgPblh,
      ventilation_coefficient: avgVent,
      dispersion_category: avgVent < 2000 ? 'Severe Stagnation' : avgVent < 5500 ? 'Moderate Dispersion' : 'Favorable Dispersion',
      inversion_status: avgVent < 2000 ? 'Strong Surface Inversion Active' : 'Weak Inversion',
      air_stagnation_index: avgStagnation,
      synoptic_overview: synopticText,
      air_mass_trajectory: trajectoryText
    },
    wind_rose: windRose,
    hourly_forecast: hourly24h,
    stations: regCells.slice(0, 10).map(c => ({
      cell_id: c.cell_id,
      name: c.name || `Station ${c.cell_id.slice(0, 8)}`,
      lat: c.lat,
      lon: c.lon,
      wind_speed_kmh: c.wind_speed_kmh,
      wind_gusts_kmh: c.wind_gusts_kmh,
      wind_cardinal: c.wind_cardinal,
      wind_dir: c.wind_dir,
      temperature_c: c.temperature_c,
      humidity_pct: c.humidity_pct,
      boundary_layer_height: c.boundary_layer_height,
      ventilation_coefficient: c.ventilation_coefficient,
      dispersion_category: c.dispersion_category
    }))
  };
});

fs.writeFileSync(path.join(DATA_DIR, 'india_synoptic_weather.json'), JSON.stringify(synopticWeatherReports, null, 2));

console.log(`Successfully generated Pan-India dataset! Total cells: ${allFeaturesH0.length} (Added ${newCellCount} cells across India).`);
console.log('Successfully generated Synoptic Weather & Dispersion Reports for all regions.');
