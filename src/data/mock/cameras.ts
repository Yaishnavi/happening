import type { TrafficCamera } from '../../types'

// Mock City of Austin traffic cameras. Images are placeholders that render without a backend;
// the real feed uses https://cctv.austinmobility.io/image/{camera_id}.jpg.

const CAMS: [id: string, name: string, lat: number, lng: number][] = [
  ['674', 'Cesar Chavez St / IH 35 Svc Rd', 30.2610, -97.7358],
  ['101', 'Congress Ave / 6th St', 30.2686, -97.7428],
  ['102', 'Congress Ave / Cesar Chavez St', 30.2636, -97.7448],
  ['103', 'S Congress Ave / Riverside Dr', 30.2603, -97.7466],
  ['104', 'S Congress Ave / Oltorf St', 30.2404, -97.7521],
  ['105', 'Lamar Blvd / 5th St', 30.2702, -97.7537],
  ['106', 'Lamar Blvd / Cesar Chavez St', 30.2669, -97.7563],
  ['107', 'S Lamar Blvd / Barton Springs Rd', 30.2617, -97.7615],
  ['108', 'Barton Springs Rd / Azie Morton Rd', 30.2638, -97.7685],
  ['109', 'Mopac Expy / Bee Caves Rd', 30.2724, -97.7790],
  ['110', 'Mopac Expy / W 35th St', 30.3062, -97.7551],
  ['111', 'Guadalupe St / 24th St', 30.2873, -97.7419],
  ['112', 'Guadalupe St / MLK Jr Blvd', 30.2817, -97.7419],
  ['113', 'San Jacinto Blvd / 15th St', 30.2783, -97.7375],
  ['114', 'Red River St / 12th St', 30.2737, -97.7346],
  ['115', 'Red River St / 7th St', 30.2690, -97.7357],
  ['116', 'E 6th St / IH 35 Svc Rd', 30.2655, -97.7343],
  ['117', 'E 7th St / Chicon St', 30.2627, -97.7240],
  ['118', 'E Cesar Chavez St / Chicon St', 30.2567, -97.7258],
  ['119', 'Rainey St / Driskill St', 30.2577, -97.7389],
  ['120', 'E Riverside Dr / Lakeshore Blvd', 30.2475, -97.7290],
  ['121', 'E Riverside Dr / Pleasant Valley Rd', 30.2393, -97.7272],
  ['122', 'IH 35 / E MLK Jr Blvd', 30.2817, -97.7298],
  ['123', 'IH 35 / Dean Keeton St', 30.2880, -97.7276],
  ['124', 'IH 35 / E 51st St', 30.3100, -97.7155],
  ['125', 'Airport Blvd / Manor Rd', 30.2869, -97.7066],
  ['126', 'Airport Blvd / E 51st St', 30.3122, -97.7128],
  ['127', 'Burnet Rd / W Koenig Ln', 30.3283, -97.7398],
  ['128', 'Burnet Rd / Braker Ln', 30.3887, -97.7254],
  ['129', 'Lamar Blvd / Rundberg Ln', 30.3627, -97.6942],
  ['130', 'Mopac Expy / Parmer Ln', 30.4105, -97.7092],
  ['131', 'S 1st St / W Oltorf St', 30.2412, -97.7605],
  ['132', 'S Lamar Blvd / W Oltorf St', 30.2462, -97.7748],
  ['133', 'Ben White Blvd / S Congress Ave', 30.2201, -97.7643],
  ['134', 'Ben White Blvd / IH 35', 30.2201, -97.7525],
  ['135', 'Montopolis Dr / E Riverside Dr', 30.2343, -97.7012],
  ['136', 'W 38th St / Medical Pkwy', 30.3055, -97.7448],
  ['137', 'Enfield Rd / Exposition Blvd', 30.2858, -97.7671],
  ['138', 'Lake Austin Blvd / Veterans Dr', 30.2802, -97.7739],
  ['139', 'Dean Keeton St / San Jacinto Blvd', 30.2866, -97.7364],
  ['140', 'E MLK Jr Blvd / Chicon St', 30.2812, -97.7189],
]

export function mockCameras(): TrafficCamera[] {
  return CAMS.map(([id, name, lat, lng]) => ({
    id,
    name,
    lat,
    lng,
    imageUrl: `https://picsum.photos/seed/${id}/640/360`,
  }))
}
