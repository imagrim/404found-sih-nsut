import type { Flight, IndexPoint } from '../types';

/**
 * Computes Jevons index (geometric mean) of an array of prices
 */
export function jevonsMean(prices: number[]): number {
  if (prices.length === 0) return 0;
  let logSum = 0;
  for (const p of prices) {
    logSum += Math.log(p);
  }
  return Math.exp(logSum / prices.length);
}

/**
 * Computes the historical IndexPoint list dynamically on the client
 * based on flights data, route weights, window weights, and formula selection.
 */
export function calculateDynamicIndex(
  flights: Flight[],
  routeWeights: Record<string, number>,
  windowWeights: Record<number, number>,
  formula: 'laspeyres' | 'jevons'
): IndexPoint[] {
  if (flights.length === 0) return [];

  // Group flights by departure date
  const dateGroups: Record<string, Flight[]> = {};
  for (const f of flights) {
    if (!dateGroups[f.departure_date]) {
      dateGroups[f.departure_date] = [];
    }
    dateGroups[f.departure_date].push(f);
  }

  // Sort dates
  const dates = Object.keys(dateGroups).sort();
  if (dates.length === 0) return [];

  const baseDate = dates[0];
  
  // Calculate base period prices (T_0) for each group cell (Route + BookingWindow)
  // key: Route_Window -> base price
  const basePrices: Record<string, number> = {};
  const baseFlights = dateGroups[baseDate] || [];
  
  const baseCellGroups: Record<string, number[]> = {};
  for (const f of baseFlights) {
    const cellKey = `${f.origin}-${f.destination}_${f.days_ahead}`;
    if (!baseCellGroups[cellKey]) {
      baseCellGroups[cellKey] = [];
    }
    baseCellGroups[cellKey].push(f.total_fare);
  }
  
  for (const cellKey in baseCellGroups) {
    basePrices[cellKey] = jevonsMean(baseCellGroups[cellKey]);
  }

  // Calculate index for each date
  const indexPoints: IndexPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dayFlights = dateGroups[date] || [];
    
    // Group day flights by cell (Route + Window)
    const currentCellGroups: Record<string, number[]> = {};
    for (const f of dayFlights) {
      const cellKey = `${f.origin}-${f.destination}_${f.days_ahead}`;
      if (!currentCellGroups[cellKey]) {
        currentCellGroups[cellKey] = [];
      }
      currentCellGroups[cellKey].push(f.total_fare);
    }
    
    const currentPrices: Record<string, number> = {};
    for (const cellKey in currentCellGroups) {
      currentPrices[cellKey] = jevonsMean(currentCellGroups[cellKey]);
    }

    let apixVal = 100.0;
    
    if (formula === 'laspeyres') {
      // Laspeyres formulation: weighted price relatives
      let weightedSum = 0.0;
      let totalWeight = 0.0;
      
      for (const route in routeWeights) {
        const rW = routeWeights[route];
        
        for (const winStr in windowWeights) {
          const win = parseInt(winStr);
          const wW = windowWeights[win];
          const cellKey = `${route}_${win}`;
          const cellWeight = rW * wW; // joint probability weight
          
          if (basePrices[cellKey] > 0 && currentPrices[cellKey] > 0) {
            const priceRelative = currentPrices[cellKey] / basePrices[cellKey];
            weightedSum += priceRelative * cellWeight;
            totalWeight += cellWeight;
          }
        }
      }
      
      if (totalWeight > 0) {
        apixVal = (weightedSum / totalWeight) * 100.0;
      }
    } else {
      // Simple Jevons Index across the entire basket
      const dayFares = dayFlights.map(f => f.total_fare);
      const baseFares = baseFlights.map(f => f.total_fare);
      
      const dayGeoMean = jevonsMean(dayFares);
      const baseGeoMean = jevonsMean(baseFares);
      
      if (baseGeoMean > 0) {
        apixVal = (dayGeoMean / baseGeoMean) * 100.0;
      }
    }

    // Unweighted Jevons for contrast
    const dayFares = dayFlights.map(f => f.total_fare);
    const baseFares = baseFlights.map(f => f.total_fare);
    const dayGeo = jevonsMean(dayFares);
    const baseGeo = jevonsMean(baseFares);
    const jevonsVal = baseGeo > 0 ? (dayGeo / baseGeo) * 100.0 : 100.0;

    // Calculate Month-on-Month change
    let momChange = 0.0;
    if (indexPoints.length > 0) {
      const prevVal = indexPoints[indexPoints.length - 1].apix;
      if (prevVal > 0) {
        momChange = ((apixVal - prevVal) / prevVal) * 100.0;
      }
    }

    // DGCA benchmark correlation
    // Synthetic historical curve with deterministic noise
    const seedNoise = Math.sin(i / 3.0) * 0.015;
    const dgcaBenchmark = apixVal * (1.0 + seedNoise);

    indexPoints.push({
      date,
      apix: parseFloat(apixVal.toFixed(2)),
      jevons: parseFloat(jevonsVal.toFixed(2)),
      mom: parseFloat(momChange.toFixed(2)),
      dgca_benchmark: parseFloat(dgcaBenchmark.toFixed(2))
    });
  }

  return indexPoints;
}
