/**
 * Fills the `places` table in src/data/location-centroids.json.
 *
 * Place-name lookup cannot disambiguate namesakes: postcodes.io answers
 * "Croydon" with one in Cambridgeshire and "Newcastle" with a Shropshire
 * village, because its `local_type` describes the form of a settlement, not how
 * well known it is. So the well-known places are resolved here instead, once,
 * via each town's central postcode outcode. Coordinates come from the API
 * rather than being typed in by hand.
 *
 * Run: node scripts/build-place-centroids.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLACES = [
  ["London", "WC2N"], ["Manchester", "M1"], ["Birmingham", "B1"], ["Leeds", "LS1"],
  ["Glasgow", "G1"], ["Liverpool", "L1"], ["Bristol", "BS1"], ["Sheffield", "S1"],
  ["Edinburgh", "EH1"], ["Cardiff", "CF10"], ["Newcastle upon Tyne", "NE1"], ["Newcastle", "NE1"],
  ["Nottingham", "NG1"], ["Leicester", "LE1"], ["Coventry", "CV1"], ["Bradford", "BD1"],
  ["Brighton", "BN1"], ["Southampton", "SO14"], ["Portsmouth", "PO1"], ["Plymouth", "PL1"],
  ["Oxford", "OX1"], ["Cambridge", "CB1"], ["York", "YO1"], ["Norwich", "NR1"],
  ["Exeter", "EX1"], ["Bath", "BA1"], ["Derby", "DE1"], ["Stoke-on-Trent", "ST1"],
  ["Wolverhampton", "WV1"], ["Milton Keynes", "MK9"], ["Croydon", "CR0"],
  ["Kingston upon Thames", "KT1"], ["Luton", "LU1"], ["Northampton", "NN1"],
  ["Aberdeen", "AB10"], ["Dundee", "DD1"], ["Inverness", "IV1"], ["Swansea", "SA1"],
  ["Newport", "NP20"], ["Hull", "HU1"], ["Preston", "PR1"], ["Blackpool", "FY1"],
  ["Middlesbrough", "TS1"], ["Sunderland", "SR1"], ["Bournemouth", "BH1"], ["Ipswich", "IP1"],
  ["Peterborough", "PE1"], ["Gloucester", "GL1"], ["Chester", "CH1"], ["Lincoln", "LN1"],
  ["Canterbury", "CT1"], ["Winchester", "SO23"], ["Salisbury", "SP1"], ["Worcester", "WR1"],
  ["Carlisle", "CA1"], ["Lancaster", "LA1"], ["Durham", "DH1"], ["Wakefield", "WF1"],
  ["Huddersfield", "HD1"], ["Bolton", "BL1"], ["Stockport", "SK1"], ["Oldham", "OL1"],
  ["Doncaster", "DN1"], ["Barnsley", "S70"], ["Warrington", "WA1"], ["Southend-on-Sea", "SS1"],
  ["Colchester", "CO1"], ["Chelmsford", "CM1"], ["Watford", "WD17"], ["St Albans", "AL1"],
  ["Slough", "SL1"], ["Guildford", "GU1"], ["Woking", "GU21"], ["Basingstoke", "RG21"],
  ["Maidstone", "ME14"], ["Crawley", "RH10"], ["Eastbourne", "BN21"], ["Hastings", "TN34"],
  ["Cheltenham", "GL50"], ["Taunton", "TA1"], ["Torquay", "TQ1"], ["Truro", "TR1"],
  ["Shrewsbury", "SY1"], ["Telford", "TF1"], ["Stafford", "ST16"], ["Blackburn", "BB1"],
  ["Wigan", "WN1"], ["Salford", "M3"], ["Bury", "BL9"], ["Rochdale", "OL16"],
  ["Reading", "RG1"], ["Swindon", "SN1"], ["Thame", "OX9"], ["Banbury", "OX16"],
  ["Abingdon", "OX14"], ["Didcot", "OX11"], ["Wantage", "OX12"], ["Bicester", "OX26"],
  ["Witney", "OX28"], ["Henley-on-Thames", "RG9"],
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "src/data/location-centroids.json");
const data = JSON.parse(readFileSync(file, "utf8"));

let added = 0, failed = [];
for (const [name, outcode] of PLACES) {
  const key = name.toLowerCase();
  if (data.places[key]) continue;
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (!res.ok) { failed.push(`${name} (${outcode}: ${res.status})`); continue; }
    const { result } = await res.json();
    if (typeof result?.latitude !== "number") { failed.push(`${name} (${outcode}: no coords)`); continue; }
    data.places[key] = { latitude: result.latitude, longitude: result.longitude, label: name };
    added += 1;
  } catch (error) {
    failed.push(`${name} (${outcode}: ${error.message})`);
  }
}

data._meta.placesSource = "postcodes.io /outcodes, via scripts/build-place-centroids.mjs";
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`added ${added} places, ${Object.keys(data.places).length} total`);
if (failed.length) console.log("failed:", failed.join(", "));
