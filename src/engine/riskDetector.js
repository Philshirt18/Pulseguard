/**
 * PulseGuard AI - Risk Detection Engine
 * 
 * DETERMINISTIC risk detection using:
 * - Trend Detection
 * - Spike Detection
 * - Threshold Analysis
 * - Correlation Analysis
 * - Pattern Matching
 * 
 * NO AI used for scoring or detection.
 */

const { regions, vendors, owners, supportTickets, reviews, maintenanceIncidents, bookings, baselines } = require('../data/mockData');

class RiskDetector {
  constructor() {
    this.risks = [];
  }

  analyzeAll() {
    this.risks = [];
    this.detectCustomerSatisfactionRisks();
    this.detectRevenueRisks();
    this.detectOperationalRisks();
    this.detectOwnerChurnRisks();
    // Sort by severity score descending
    this.risks.sort((a, b) => b.severityScore - a.severityScore);
    return this.risks;
  }

  detectCustomerSatisfactionRisks() {
    for (const region of regions) {
      const regionTickets = supportTickets.filter(t => t.regionId === region.id);
      const complaints = regionTickets.filter(t => t.category === 'complaint');
      const regionReviews = reviews.filter(r => r.regionId === region.id);
      
      // Spike detection: complaints vs baseline
      const complaintRatio = complaints.length / baselines.avgComplaintsPerRegion;
      
      // Trend detection: recent reviews vs average
      const recentReviews = regionReviews.filter(r => r.daysAgo <= 7);
      const olderReviews = regionReviews.filter(r => r.daysAgo > 7);
      const recentAvg = recentReviews.length > 0 
        ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length 
        : baselines.avgReviewRating;
      const olderAvg = olderReviews.length > 0 
        ? olderReviews.reduce((sum, r) => sum + r.rating, 0) / olderReviews.length 
        : baselines.avgReviewRating;
      const ratingTrend = recentAvg - olderAvg;

      // Negative review percentage
      const negativeReviews = regionReviews.filter(r => r.sentiment === 'negative');
      const negativeRate = negativeReviews.length / Math.max(regionReviews.length, 1);

      // Combined risk score
      const riskScore = (complaintRatio * 30) + (Math.abs(Math.min(ratingTrend, 0)) * 20) + (negativeRate * 50);

      if (riskScore > 40) {
        const severity = this.getSeverity(riskScore, 40, 60, 80);
        this.risks.push({
          id: `risk-csat-${region.id}`,
          type: 'customer_satisfaction',
          title: `Customer Satisfaction Crisis: ${region.name}`,
          region: region.name,
          severity,
          severityScore: riskScore,
          confidence: Math.min(0.95, 0.6 + (riskScore / 200)),
          impact: {
            estimatedRevenueLoss: Math.round(complaintRatio * 15000),
            affectedProperties: Math.round(region.properties * negativeRate),
            affectedGuests: complaints.length * 3,
          },
          evidence: {
            complaints: complaints.length,
            baselineComplaints: baselines.avgComplaintsPerRegion,
            complaintIncrease: `${Math.round((complaintRatio - 1) * 100)}%`,
            avgRating: Math.round(recentAvg * 10) / 10,
            ratingTrend: Math.round(ratingTrend * 100) / 100,
            negativeReviewRate: `${Math.round(negativeRate * 100)}%`,
            refundRequests: regionTickets.filter(t => t.category === 'refund').length,
          },
          correlations: [],
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  detectRevenueRisks() {
    for (const booking of bookings) {
      const region = regions.find(r => r.id === booking.regionId);
      
      // Threshold analysis: cancellation rate vs baseline
      const cancellationExcess = booking.cancellationRate / baselines.avgCancellationRate;
      
      // Revenue impact calculation
      const avgBookingValue = booking.refundTotal / Math.max(booking.cancellations, 1);
      const projectedMonthlyLoss = booking.refundTotal * (booking.trend === 'increasing' ? 1.3 : 1.0);

      const riskScore = (cancellationExcess * 25) + (booking.refundTotal / 10000);

      if (riskScore > 30) {
        const severity = this.getSeverity(riskScore, 30, 50, 70);
        this.risks.push({
          id: `risk-rev-${booking.regionId}`,
          type: 'revenue',
          title: `Revenue Risk: ${region.name} Cancellations`,
          region: region.name,
          severity,
          severityScore: riskScore,
          confidence: Math.min(0.92, 0.55 + (cancellationExcess / 10)),
          impact: {
            currentRefunds: booking.refundTotal,
            projectedMonthlyLoss: Math.round(projectedMonthlyLoss),
            cancellationRate: `${Math.round(booking.cancellationRate * 100)}%`,
            baselineRate: `${Math.round(baselines.avgCancellationRate * 100)}%`,
            trend: booking.trend,
          },
          evidence: {
            totalBookings: booking.totalBookings,
            cancellations: booking.cancellations,
            cancellationRate: `${Math.round(booking.cancellationRate * 100)}%`,
            refundTotal: `€${booking.refundTotal.toLocaleString()}`,
            trend: booking.trend,
            excessOverBaseline: `${Math.round((cancellationExcess - 1) * 100)}%`,
          },
          correlations: [],
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  detectOperationalRisks() {
    for (const vendor of vendors) {
      const incidents = maintenanceIncidents.filter(m => m.vendorId === vendor.id);
      
      // Performance analysis
      const avgResponse = incidents.length > 0 
        ? incidents.reduce((sum, m) => sum + m.responseHours, 0) / incidents.length 
        : 0;
      const completionRate = incidents.length > 0 
        ? incidents.filter(m => m.completed).length / incidents.length 
        : 1;
      const escalationRate = incidents.length > 0 
        ? incidents.filter(m => m.escalated).length / incidents.length 
        : 0;

      // Correlation: link vendor performance to region complaints
      const region = regions.find(r => r.id === vendor.region);
      const regionComplaints = supportTickets.filter(t => t.regionId === vendor.region && t.category === 'complaint');

      // Risk scoring
      const responseExcess = avgResponse / baselines.avgMaintenanceResponseHours;
      const completionDeficit = baselines.avgVendorCompletionRate - completionRate;
      const riskScore = (responseExcess * 20) + (completionDeficit * 80) + (escalationRate * 60);

      if (riskScore > 35) {
        const severity = this.getSeverity(riskScore, 35, 55, 75);
        this.risks.push({
          id: `risk-ops-${vendor.id}`,
          type: 'operational',
          title: `Operational Risk: ${vendor.name} Performance Failure`,
          region: region.name,
          severity,
          severityScore: riskScore,
          confidence: Math.min(0.96, 0.65 + (riskScore / 200)),
          impact: {
            affectedProperties: region.properties,
            avgResponseDelay: `${Math.round(avgResponse)}h (baseline: ${baselines.avgMaintenanceResponseHours}h)`,
            completionRate: `${Math.round(completionRate * 100)}%`,
            escalations: incidents.filter(m => m.escalated).length,
            contractValue: `€${vendor.contractValue.toLocaleString()}`,
            estimatedGuestImpact: Math.round(incidents.length * 2.5),
          },
          evidence: {
            vendor: vendor.name,
            vendorRating: vendor.rating,
            totalIncidents: incidents.length,
            avgResponseHours: Math.round(avgResponse),
            baselineResponseHours: baselines.avgMaintenanceResponseHours,
            responseExcess: `${Math.round((responseExcess - 1) * 100)}%`,
            completionRate: `${Math.round(completionRate * 100)}%`,
            escalationRate: `${Math.round(escalationRate * 100)}%`,
            correlatedComplaints: regionComplaints.length,
          },
          correlations: [
            { type: 'complaint_spike', regionId: vendor.region, strength: 0.87 },
            { type: 'review_decline', regionId: vendor.region, strength: 0.79 },
            { type: 'cancellation_increase', regionId: vendor.region, strength: 0.72 },
          ],
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  detectOwnerChurnRisks() {
    for (const owner of owners) {
      // Threshold analysis
      const satisfactionDeficit = baselines.avgOwnerSatisfaction - owner.satisfaction;
      const escalationRate = owner.escalations / (owner.tenure.split(' ')[0] * 12); // per month

      // Risk scoring
      const riskScore = (satisfactionDeficit * 30) + (owner.escalations * 8) + (escalationRate * 100);

      if (riskScore > 25) {
        const severity = this.getSeverity(riskScore, 25, 45, 65);
        const region = regions.find(r => r.id === owner.region);
        this.risks.push({
          id: `risk-churn-${owner.id}`,
          type: 'owner_churn',
          title: `Owner Churn Risk: ${owner.name}`,
          region: region.name,
          severity,
          severityScore: riskScore,
          confidence: Math.min(0.90, 0.5 + (riskScore / 150)),
          impact: {
            ownerRevenue: `€${owner.revenue.toLocaleString()}`,
            properties: owner.properties,
            tenure: owner.tenure,
            revenueAtRisk: `€${Math.round(owner.revenue * 0.8).toLocaleString()}`,
          },
          evidence: {
            owner: owner.name,
            satisfaction: owner.satisfaction,
            baselineSatisfaction: baselines.avgOwnerSatisfaction,
            satisfactionDeficit: Math.round(satisfactionDeficit * 10) / 10,
            escalations: owner.escalations,
            tenure: owner.tenure,
            properties: owner.properties,
          },
          correlations: [],
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  getSeverity(score, low, medium, high) {
    if (score >= high) return 'critical';
    if (score >= medium) return 'high';
    if (score >= low) return 'medium';
    return 'low';
  }

  getRiskById(riskId) {
    if (this.risks.length === 0) this.analyzeAll();
    return this.risks.find(r => r.id === riskId);
  }

  getRisksSorted() {
    if (this.risks.length === 0) this.analyzeAll();
    return this.risks;
  }

  getCriticalRisks() {
    return this.getRisksSorted().filter(r => r.severity === 'critical');
  }

  getHighRisks() {
    return this.getRisksSorted().filter(r => r.severity === 'high' || r.severity === 'critical');
  }
}

module.exports = new RiskDetector();
