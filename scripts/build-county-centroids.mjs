/**
 * Adds counties and regions to `places` in src/data/location-centroids.json.
 *
 * A county is a normal thing to type into a location box, but there is no
 * county centroid API. Each one is therefore the average of several real
 * outcode centroids spread across it, fetched from postcodes.io, so the
 * coordinates are measured rather than guessed. A rough middle is fine: nobody
 * searching "Yorkshire" wants three-metre precision, they want a radius.
 *
 * Run: node scripts/build-county-centroids.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const COUNTIES = [
  ["Yorkshire", ["LS1", "YO1", "S1", "HU1", "BD1", "HG1"]],
  ["West Yorkshire", ["LS1", "BD1", "HD1", "WF1"]],
  ["South Yorkshire", ["S1", "DN1", "S70"]],
  ["North Yorkshire", ["YO1", "HG1", "DL1"]],
  ["East Yorkshire", ["HU1", "YO25"]],
  ["Lancashire", ["PR1", "BB1", "FY1", "LA1"]],
  ["Greater Manchester", ["M1", "BL1", "OL1", "WN1", "SK1"]],
  ["Merseyside", ["L1", "CH41", "WA10"]],
  ["Cheshire", ["CH1", "CW1", "SK11"]],
  ["Cumbria", ["CA1", "LA9"]],
  ["Northumberland", ["NE46", "NE61"]],
  ["Tyne and Wear", ["NE1", "SR1"]],
  ["County Durham", ["DH1", "DL1"]],
  ["Durham", ["DH1", "DL1"]],
  ["Derbyshire", ["DE1", "S40", "SK17"]],
  ["Nottinghamshire", ["NG1", "NG18"]],
  ["Lincolnshire", ["LN1", "PE21", "NG31"]],
  ["Leicestershire", ["LE1", "LE11"]],
  ["Rutland", ["LE15"]],
  ["Northamptonshire", ["NN1", "NN15"]],
  ["Staffordshire", ["ST1", "ST16", "WS1"]],
  ["Shropshire", ["SY1", "TF1"]],
  ["Herefordshire", ["HR1"]],
  ["Worcestershire", ["WR1", "DY10"]],
  ["Warwickshire", ["CV34", "CV11"]],
  ["West Midlands", ["B1", "CV1", "WV1", "DY1"]],
  ["Norfolk", ["NR1", "PE30"]],
  ["Suffolk", ["IP1", "CO10"]],
  ["Cambridgeshire", ["CB1", "PE1"]],
  ["Essex", ["CM1", "CO1", "SS1"]],
  ["Hertfordshire", ["AL1", "WD17", "SG1"]],
  ["Bedfordshire", ["LU1", "MK40"]],
  ["Buckinghamshire", ["HP11", "MK18"]],
  ["Oxfordshire", ["OX1", "OX16", "OX11"]],
  ["Berkshire", ["RG1", "SL1", "RG21"]],
  ["Greater London", ["WC2N", "CR0", "E14", "NW1"]],
  ["London", ["WC2N", "E14", "NW1"]],
  ["Surrey", ["GU1", "KT1", "RH1"]],
  ["Kent", ["ME14", "CT1", "TN1"]],
  ["East Sussex", ["BN21", "TN34"]],
  ["West Sussex", ["RH10", "PO19", "BN11"]],
  ["Sussex", ["BN1", "RH10", "PO19"]],
  ["Hampshire", ["SO14", "PO1", "RG21"]],
  ["Isle of Wight", ["PO30"]],
  ["Dorset", ["DT1", "BH1"]],
  ["Wiltshire", ["SN1", "SP1"]],
  ["Somerset", ["TA1", "BA1"]],
  ["Devon", ["EX1", "PL1", "TQ1"]],
  ["Cornwall", ["TR1", "PL25"]],
  ["Gloucestershire", ["GL1", "GL50"]],
  ["Scotland", ["EH1", "G1", "AB10", "IV1"]],
  ["Highlands", ["IV1", "PH1"]],
  ["Fife", ["KY1"]],
  ["Aberdeenshire", ["AB10", "AB51"]],
  ["Wales", ["CF10", "SA1", "LL57", "NP20"]],
  ["South Wales", ["CF10", "SA1", "NP20"]],
  ["North Wales", ["LL57", "LL11"]],
  ["Northern Ireland", ["BT1", "BT48"]],
  ["Midlands", ["B1", "LE1", "NG1", "DE1"]],
  ["East Midlands", ["NG1", "LE1", "DE1"]],
  ["West Country", ["EX1", "TA1", "BS1"]],
  ["North East", ["NE1", "SR1", "DH1"]],
  ["North West", ["M1", "L1", "PR1"]],
  ["South East", ["ME14", "GU1", "RG1", "BN1"]],
  ["South West", ["BS1", "EX1", "PL1"]],
  ["East Anglia", ["NR1", "IP1", "CB1"]],
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "src/data/location-centroids.json");
const data = JSON.parse(readFileSync(file, "utf8"));

let added = 0;
const failed = [];

for (const [name, outcodes] of COUNTIES) {
  const key = name.toLowerCase();
  if (data.places[key]) continue;

  const points = [];
  for (const outcode of outcodes) {
    try {
      const res = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
      if (!res.ok) continue;
      const { result } = await res.json();
      if (typeof result?.latitude === "number") points.push(result);
    } catch {
      // Skip this outcode; the average of the rest is still usable.
    }
  }

  if (points.length === 0) {
    failed.push(name);
    continue;
  }

  data.places[key] = {
    latitude: points.reduce((n, p) => n + p.latitude, 0) / points.length,
    longitude: points.reduce((n, p) => n + p.longitude, 0) / points.length,
    label: name,
    // Recorded so it is obvious later that this is a wide area, not a point.
    area: true,
  };
  added += 1;
}

data._meta.countiesSource = "mean of outcode centroids, via scripts/build-county-centroids.mjs";
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`added ${added} counties/regions, ${Object.keys(data.places).length} places total`);
if (failed.length) console.log("failed:", failed.join(", "));
