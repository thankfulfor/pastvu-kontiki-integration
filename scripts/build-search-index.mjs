import { readdir, readFile, writeFile } from 'node:fs/promises';

const fixtureDirectory = new URL('../data/fixtures/old-moscow-periods/', import.meta.url);
const outputFile = new URL('../data/search-index.json', import.meta.url);

function getToponym(address) {
  return address
    .replace(/,\s*(домовладение|дом|д\.?|владение|строение|корпус)(?:\s|,|$).*$/i, '')
    .trim();
}

function getBoundsCenter(geometry) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  function visit(value) {
    if (!Array.isArray(value)) {
      return;
    }

    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [lng, lat] = value;

      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      return;
    }

    value.forEach(visit);
  }

  visit(geometry.coordinates);

  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

const files = (await readdir(fixtureDirectory)).filter((file) => file.endsWith('.geojson')).sort();
const records = [];

for (const [periodIndex, file] of files.entries()) {
  const geojson = JSON.parse(await readFile(new URL(file, fixtureDirectory), 'utf8'));

  geojson.features.forEach((feature, featureIndex) => {
    const properties = feature.properties || {};
    const name = String(properties.r_name || '').trim();
    const address = String(properties.r_adress || '').trim();

    if (!name && !address) {
      return;
    }

    records.push({
      id: `${periodIndex}:${featureIndex}`,
      p: periodIndex,
      n: name,
      a: address,
      t: getToponym(address),
      y: properties.r_years_str || properties.r_year_int || '',
      c: getBoundsCenter(feature.geometry).map((value) => Number(value.toFixed(6))),
    });
  });
}

await writeFile(outputFile, JSON.stringify(records));
console.log(`Создан индекс поиска: ${records.length} объектов.`);
