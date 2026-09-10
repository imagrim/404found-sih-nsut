import math
from statistics import median

def jevons_mean(prices):
    """
    Computes Jevons index (geometric mean) of a price list.
    """
    if not prices:
        return 0.0
    try:
        log_sum = sum(math.log(p) for p in prices if p > 0)
        return math.exp(log_sum / len(prices))
    except ValueError:
        return 0.0

def calculate_mad(prices, med):
    """
    Computes Median Absolute Deviation (MAD).
    """
    if not prices:
        return 0.0
    abs_deviations = [abs(p - med) for p in prices]
    return median(abs_deviations)

def detect_modified_z_score_anomalies(flights):
    """
    Groups flights by Route + Booking Window + Carrier to compute Modified Z-score outliers.
    Modified Z-score using Median Absolute Deviation (MAD) is highly resistant to extreme outliers.
    Formula: M_i = 0.6745 * (x_i - median) / MAD
    Threshold: M_i > 3.5 indicates a statistical outlier.
    """
    groups = {}
    for f in flights:
        key = f"{f['origin']}-{f['destination']}_{f['days_ahead']}_{f['carrier']}"
        if key not in groups:
            groups[key] = []
        groups[key].append(f)
        
    cleaned = []
    anomalies = []
    
    for key, group in groups.items():
        prices = [f['total_fare'] for f in group]
        if len(prices) < 3:
            # Too few flights to estimate MAD, treat all as clean
            for f in group:
                f['status'] = 'clean'
            cleaned.extend(group)
            continue
            
        med = median(prices)
        mad = calculate_mad(prices, med)
        
        # Avoid division by zero if all fares are identical
        if mad == 0:
            for f in group:
                f['status'] = 'clean'
            cleaned.extend(group)
            continue
            
        for f in group:
            # Modified Z-score calculation
            m_score = 0.6745 * (f['total_fare'] - med) / mad
            
            if abs(m_score) > 3.5:
                # Flag as anomaly
                f['status'] = 'anomaly'
                f['z_score'] = round(m_score, 2)
                f['reason'] = f"Modified Z-score (+{round(m_score, 1)}) exceeds robust threshold 3.5 (Median: ₹{int(med):,}, MAD: {int(mad)})"
                anomalies.append(f)
            else:
                f['status'] = 'clean'
                cleaned.extend([f])
                
    return cleaned, anomalies

def calculate_laspeyres_cpi(flights, route_weights, window_weights, formula_type='laspeyres'):
    """
    Compiles daily Airfare Price Index (APIx) values based on raw flights database.
    Supports both weighted Laspeyres and Jevons formulations.
    """
    if not flights:
        return []
        
    # Group flights by departure date
    date_groups = {}
    for f in flights:
        d = f['departure_date']
        if d not in date_groups:
            date_groups[d] = []
        date_groups[d].append(f)
        
    dates = sorted(date_groups.keys())
    if not dates:
        return []
        
    base_date = dates[0]
    base_flights = date_groups[base_date]
    
    # Calculate base prices for each cell (Route + BookingWindow)
    base_prices = {}
    base_cell_groups = {}
    for f in base_flights:
        cell_key = f"{f['origin']}-{f['destination']}_{f['days_ahead']}"
        if cell_key not in base_cell_groups:
            base_cell_groups[cell_key] = []
        base_cell_groups[cell_key].append(f['total_fare'])
        
    for cell_key, fares in base_cell_groups.items():
        base_prices[cell_key] = jevons_mean(fares)
        
    index_history = []
    
    for i, date in enumerate(dates):
        day_flights = date_groups[date]
        
        # Current cell averages
        current_cell_groups = {}
        for f in day_flights:
            cell_key = f"{f['origin']}-{f['destination']}_{f['days_ahead']}"
            if cell_key not in current_cell_groups:
                current_cell_groups[cell_key] = []
            current_cell_groups[cell_key].append(f['total_fare'])
            
        current_prices = {}
        for cell_key, fares in current_cell_groups.items():
            current_prices[cell_key] = jevons_mean(fares)
            
        apix_val = 100.0
        
        if formula_type == 'laspeyres':
          # Double-weight arithmetic relative (Laspeyres method)
          weighted_sum = 0.0
          total_weight = 0.0
          
          for route, route_w in route_weights.items():
              for win_str, win_w in window_weights.items():
                  win = int(win_str)
                  cell_key = f"{route}_{win}"
                  cell_weight = route_w * win_w
                  
                  if cell_key in base_prices and cell_key in current_prices:
                      if base_prices[cell_key] > 0:
                          ratio = current_prices[cell_key] / base_prices[cell_key]
                          weighted_sum += ratio * cell_weight
                          total_weight += cell_weight
                          
          if total_weight > 0:
              apix_val = (weighted_sum / total_weight) * 100.0
        else:
          # Standard geometric Jevons across all tickets compared to base
          day_fares = [f['total_fare'] for f in day_flights]
          base_fares = [f['total_fare'] for f in base_flights]
          day_geo = jevons_mean(day_fares)
          base_geo = jevons_mean(base_fares)
          if base_geo > 0:
              apix_val = (day_geo / base_geo) * 100.0
              
        # Calculate standard unweighted Jevons for contrast
        day_fares_all = [f['total_fare'] for f in day_flights]
        base_fares_all = [f['total_fare'] for f in base_flights]
        day_geo_all = jevons_mean(day_fares_all)
        base_geo_all = jevons_mean(base_fares_all)
        jevons_val = (day_geo_all / base_geo_all) * 100.0 if base_geo_all > 0 else 100.0
        
        # Calculate MoM
        mom_change = 0.0
        if len(index_history) > 0:
            prev_apix = index_history[-1]['apix']
            if prev_apix > 0:
                mom_change = ((apix_val - prev_apix) / prev_apix) * 100.0
                
        # DGCA simulated correlation (standard target is slightly offset with noise)
        dgca_val = apix_val * (1.0 + math.sin(i / 2.5) * 0.015)
        
        index_history.append({
            'date': date,
            'apix': round(apix_val, 2),
            'jevons': round(jevons_val, 2),
            'mom': round(mom_change, 2),
            'dgca_benchmark': round(dgca_val, 2)
        })
        
    return index_history

def compute_pearson_correlation(series_a, series_b):
    """
    Computes Pearson Correlation Coefficient (R) between two index histories.
    """
    if len(series_a) != len(series_b) or len(series_a) < 2:
        return 0.0
        
    mean_a = sum(series_a) / len(series_a)
    mean_b = sum(series_b) / len(series_b)
    
    num = sum((a - mean_a) * (b - mean_b) for a, b in zip(series_a, series_b))
    den_a = sum((a - mean_a)**2 for a in series_a)
    den_b = sum((b - mean_b)**2 for b in series_b)
    
    if den_a == 0 or den_b == 0:
        return 0.0
    return num / math.sqrt(den_a * den_b)

def compute_rmse(series_a, series_b):
    """
    Computes Root Mean Square Error (RMSE).
    """
    if len(series_a) != len(series_b) or not series_a:
        return 0.0
    squared_errors = [(a - b)**2 for a, b in zip(series_a, series_b)]
    return math.sqrt(sum(squared_errors) / len(series_a))
