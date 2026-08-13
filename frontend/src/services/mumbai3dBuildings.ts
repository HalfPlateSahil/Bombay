export function generateMumbai3DBuildings() {
  const features: any[] = [];

  // Continuous 35m spatial grid with dense 3D spatial building footprints
  const minLat = 18.90;
  const maxLat = 19.28;
  const minLon = 72.80;
  const maxLon = 72.98;

  const latStep = 0.00035; // ~38 meters
  const lonStep = 0.00035; // ~35 meters

  let bldg_id = 1;

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lon = minLon; lon <= maxLon; lon += lonStep) {
      // Water body masking (Arabian Sea west of coastline)
      if (lon < 72.812 && lat < 18.96) continue;
      if (lon < 72.805 && lat >= 18.96 && lat < 19.05) continue;
      if (lon < 72.800 && lat >= 19.05) continue;

      // Footprint size: ~30m x ~30m
      const w = 0.00025;
      const h = 0.00025;

      const poly = [
        [lon - w, lat - h],
        [lon + w, lat - h],
        [lon + w, lat + h],
        [lon - w, lat + h],
        [lon - w, lat - h]
      ];

      let baseH = 25;
      let maxH = 75;

      // South Mumbai & Worli Skyscrapers
      if (lat < 19.03 && lon < 72.84) {
        baseH = 50;
        maxH = 260;
      }
      // Bandra & BKC Highrises
      else if (lat >= 19.04 && lat <= 19.08 && lon >= 72.82 && lon <= 72.88) {
        baseH = 40;
        maxH = 140;
      }
      // Andheri & Powai Highrises
      else if (lat >= 19.10 && lat <= 19.16 && lon >= 72.82 && lon <= 72.92) {
        baseH = 35;
        maxH = 150;
      }

      const bHeight = baseH + Math.round((Math.sin(bldg_id * 1.7) + 1.0) * 0.5 * (maxH - baseH));

      features.push({
        type: "Feature",
        id: `bldg_${bldg_id}`,
        properties: {
          id: bldg_id,
          name: `Mumbai Structure #${bldg_id}`,
          height: bHeight,
          min_height: 0,
          levels: Math.max(3, Math.round(bHeight / 3.2))
        },
        geometry: {
          type: "Polygon",
          coordinates: [poly]
        }
      });
      bldg_id++;
    }
  }

  return {
    type: "FeatureCollection",
    features
  };
}
