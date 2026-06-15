/**
 * PulseGuard AI - Mock Data for EuroStay Rentals
 * European vacation rental company: 15,000 properties, 750 employees
 * 
 * HIDDEN PATTERNS (for PulseGuard to discover):
 * 1. Vendor Atlas Services causing maintenance delays in Southern Spain
 * 2. Coastal Portugal properties showing revenue decline from cancellations
 * 3. Owner Miguel Fernandez at churn risk due to escalations
 * 4. Emerging negative review trend in Barcelona apartments
 */

const regions = [
  { id: 'reg-001', name: 'Southern Spain', country: 'Spain', properties: 3200, manager: 'Carlos Mendez' },
  { id: 'reg-002', name: 'Coastal Portugal', country: 'Portugal', properties: 2100, manager: 'Ana Silva' },
  { id: 'reg-003', name: 'French Riviera', country: 'France', properties: 2800, manager: 'Pierre Dupont' },
  { id: 'reg-004', name: 'Italian Lakes', country: 'Italy', properties: 2400, manager: 'Marco Rossi' },
  { id: 'reg-005', name: 'Greek Islands', country: 'Greece', properties: 1900, manager: 'Elena Papadopoulos' },
  { id: 'reg-006', name: 'Barcelona Metro', country: 'Spain', properties: 1400, manager: 'Jordi Puig' },
  { id: 'reg-007', name: 'Croatian Coast', country: 'Croatia', properties: 1200, manager: 'Ivan Horvat' },
];

const vendors = [
  { id: 'ven-001', name: 'Atlas Services', region: 'reg-001', type: 'maintenance', rating: 2.1, responseTime: 72, contractValue: 450000 },
  { id: 'ven-002', name: 'CleanPro Mediterranean', region: 'reg-001', type: 'cleaning', rating: 4.2, responseTime: 4, contractValue: 320000 },
  { id: 'ven-003', name: 'FixRight Portugal', region: 'reg-002', type: 'maintenance', rating: 4.5, responseTime: 8, contractValue: 280000 },
  { id: 'ven-004', name: 'Riviera Maintenance Co', region: 'reg-003', type: 'maintenance', rating: 4.1, responseTime: 12, contractValue: 390000 },
  { id: 'ven-005', name: 'LakeView Services', region: 'reg-004', type: 'maintenance', rating: 4.3, responseTime: 10, contractValue: 310000 },
  { id: 'ven-006', name: 'Aegean Fix', region: 'reg-005', type: 'maintenance', rating: 3.8, responseTime: 18, contractValue: 220000 },
  { id: 'ven-007', name: 'Barcelona Home Care', region: 'reg-006', type: 'maintenance', rating: 3.4, responseTime: 24, contractValue: 180000 },
];

const owners = [
  { id: 'own-001', name: 'Miguel Fernandez', region: 'reg-001', properties: 12, tenure: '6 years', revenue: 890000, satisfaction: 2.3, escalations: 8 },
  { id: 'own-002', name: 'Sophie Laurent', region: 'reg-003', properties: 8, tenure: '4 years', revenue: 720000, satisfaction: 4.1, escalations: 1 },
  { id: 'own-003', name: 'Antonio Carvalho', region: 'reg-002', properties: 15, tenure: '7 years', revenue: 1100000, satisfaction: 3.8, escalations: 2 },
  { id: 'own-004', name: 'Giovanni Bianchi', region: 'reg-004', properties: 6, tenure: '3 years', revenue: 480000, satisfaction: 4.5, escalations: 0 },
  { id: 'own-005', name: 'Helena Papadimitriou', region: 'reg-005', properties: 9, tenure: '5 years', revenue: 650000, satisfaction: 3.9, escalations: 1 },
  { id: 'own-006', name: 'Clara Vidal', region: 'reg-006', properties: 4, tenure: '2 years', revenue: 310000, satisfaction: 3.2, escalations: 3 },
];

// Support tickets - last 30 days with clear spike pattern in Southern Spain
const supportTickets = [
  // Southern Spain - SPIKE (hidden pattern: Atlas Services causing issues)
  ...generateTickets('reg-001', 145, { complaint: 89, maintenance: 67, refund: 34 }),
  // Coastal Portugal - moderate
  ...generateTickets('reg-002', 52, { complaint: 18, maintenance: 12, refund: 22 }),
  // French Riviera - normal
  ...generateTickets('reg-003', 38, { complaint: 12, maintenance: 8, refund: 6 }),
  // Italian Lakes - normal
  ...generateTickets('reg-004', 29, { complaint: 8, maintenance: 6, refund: 4 }),
  // Greek Islands - normal
  ...generateTickets('reg-005', 34, { complaint: 10, maintenance: 9, refund: 5 }),
  // Barcelona Metro - emerging issue
  ...generateTickets('reg-006', 61, { complaint: 38, maintenance: 15, refund: 12 }),
  // Croatian Coast - normal
  ...generateTickets('reg-007', 22, { complaint: 6, maintenance: 4, refund: 3 }),
];

function generateTickets(regionId, total, breakdown) {
  const tickets = [];
  const categories = ['complaint', 'maintenance', 'refund', 'inquiry', 'booking'];
  
  for (let i = 0; i < total; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    let category = 'inquiry';
    if (i < breakdown.complaint) category = 'complaint';
    else if (i < breakdown.complaint + breakdown.maintenance) category = 'maintenance';
    else if (i < breakdown.complaint + breakdown.maintenance + breakdown.refund) category = 'refund';

    tickets.push({
      id: `ticket-${regionId}-${i.toString().padStart(3, '0')}`,
      regionId,
      category,
      daysAgo,
      resolved: category === 'inquiry' ? true : Math.random() > 0.4,
      severity: category === 'complaint' ? (Math.random() > 0.5 ? 'high' : 'medium') : 'low',
    });
  }
  return tickets;
}

// Reviews - last 30 days
const reviews = [
  // Southern Spain - deteriorating
  ...generateReviews('reg-001', 210, 2.8, -1.2),
  // Coastal Portugal - stable
  ...generateReviews('reg-002', 180, 4.1, -0.1),
  // French Riviera - good
  ...generateReviews('reg-003', 195, 4.4, 0.1),
  // Italian Lakes - good
  ...generateReviews('reg-004', 160, 4.5, 0.0),
  // Greek Islands - good
  ...generateReviews('reg-005', 140, 4.2, 0.0),
  // Barcelona Metro - declining (emerging trend)
  ...generateReviews('reg-006', 120, 3.4, -0.6),
  // Croatian Coast - good
  ...generateReviews('reg-007', 90, 4.3, 0.1),
];

function generateReviews(regionId, count, avgRating, trend) {
  const reviews = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const trendFactor = trend * (1 - daysAgo / 30);
    const rating = Math.max(1, Math.min(5, avgRating + trendFactor + (Math.random() - 0.5) * 1.5));
    
    reviews.push({
      id: `review-${regionId}-${i.toString().padStart(3, '0')}`,
      regionId,
      rating: Math.round(rating * 10) / 10,
      daysAgo,
      sentiment: rating < 3 ? 'negative' : rating < 4 ? 'neutral' : 'positive',
    });
  }
  return reviews;
}

// Maintenance incidents - Atlas Services is the problem
const maintenanceIncidents = [
  // Atlas Services (Southern Spain) - terrible performance
  ...generateMaintenance('ven-001', 'reg-001', 67, { avgDelay: 72, completionRate: 0.45, escalations: 23 }),
  // CleanPro - fine
  ...generateMaintenance('ven-002', 'reg-001', 28, { avgDelay: 4, completionRate: 0.95, escalations: 1 }),
  // FixRight Portugal - good
  ...generateMaintenance('ven-003', 'reg-002', 18, { avgDelay: 8, completionRate: 0.92, escalations: 2 }),
  // Riviera Maintenance - good
  ...generateMaintenance('ven-004', 'reg-003', 22, { avgDelay: 12, completionRate: 0.88, escalations: 3 }),
  // LakeView - good
  ...generateMaintenance('ven-005', 'reg-004', 15, { avgDelay: 10, completionRate: 0.91, escalations: 1 }),
  // Aegean Fix - okay
  ...generateMaintenance('ven-006', 'reg-005', 20, { avgDelay: 18, completionRate: 0.82, escalations: 4 }),
  // Barcelona Home Care - declining
  ...generateMaintenance('ven-007', 'reg-006', 31, { avgDelay: 24, completionRate: 0.72, escalations: 7 }),
];

function generateMaintenance(vendorId, regionId, count, stats) {
  const incidents = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const delay = Math.max(0, stats.avgDelay + (Math.random() - 0.3) * stats.avgDelay);
    const completed = Math.random() < stats.completionRate;

    incidents.push({
      id: `maint-${vendorId}-${i.toString().padStart(3, '0')}`,
      vendorId,
      regionId,
      daysAgo,
      responseHours: Math.round(delay),
      completed,
      escalated: i < stats.escalations,
      type: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural'][Math.floor(Math.random() * 5)],
    });
  }
  return incidents;
}

// Bookings and Cancellations
const bookings = [
  // Southern Spain - high cancellations
  { regionId: 'reg-001', totalBookings: 890, cancellations: 156, cancellationRate: 0.175, refundTotal: 234000, trend: 'increasing' },
  // Coastal Portugal - moderate cancellations (revenue risk)
  { regionId: 'reg-002', totalBookings: 620, cancellations: 98, cancellationRate: 0.158, refundTotal: 178000, trend: 'increasing' },
  // French Riviera - normal
  { regionId: 'reg-003', totalBookings: 780, cancellations: 47, cancellationRate: 0.060, refundTotal: 89000, trend: 'stable' },
  // Italian Lakes - normal
  { regionId: 'reg-004', totalBookings: 540, cancellations: 32, cancellationRate: 0.059, refundTotal: 61000, trend: 'stable' },
  // Greek Islands - normal
  { regionId: 'reg-005', totalBookings: 480, cancellations: 29, cancellationRate: 0.060, refundTotal: 52000, trend: 'stable' },
  // Barcelona Metro - rising
  { regionId: 'reg-006', totalBookings: 410, cancellations: 52, cancellationRate: 0.127, refundTotal: 94000, trend: 'increasing' },
  // Croatian Coast - normal
  { regionId: 'reg-007', totalBookings: 320, cancellations: 18, cancellationRate: 0.056, refundTotal: 31000, trend: 'stable' },
];

// Historical baselines (for comparison)
const baselines = {
  avgComplaintsPerRegion: 25,
  avgMaintenanceResponseHours: 14,
  avgCancellationRate: 0.065,
  avgReviewRating: 4.2,
  avgOwnerSatisfaction: 4.0,
  avgVendorCompletionRate: 0.90,
  avgRefundRate: 0.04,
};

module.exports = {
  regions,
  vendors,
  owners,
  supportTickets,
  reviews,
  maintenanceIncidents,
  bookings,
  baselines,
};
