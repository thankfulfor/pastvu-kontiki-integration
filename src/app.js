const fixtureUrl = './data/fixtures/old-moscow-sample.geojson';

const map = L.map('map', {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([55.751244, 37.618423], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const emptyValue = 'не указано';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return emptyValue;
  }

  return escapeHtml(value);
}

function buildPopup(properties) {
  const title = formatValue(properties.r_name || properties.r_adress);
  const year = formatValue(properties.r_years_str || properties.r_year_int);
  const address = formatValue(properties.r_adress);
  const floors = formatValue(properties.r_floors);

  return `
    <article class="popup">
      <h3>${title}</h3>
      <dl>
        <div>
          <dt>Год</dt>
          <dd>${year}</dd>
        </div>
        <div>
          <dt>Адрес</dt>
          <dd>${address}</dd>
        </div>
        <div>
          <dt>Этажей</dt>
          <dd>${floors}</dd>
        </div>
      </dl>
    </article>
  `;
}

function setCount(count) {
  const countNode = document.querySelector('#feature-count');

  if (countNode) {
    countNode.textContent = String(count);
  }
}

fetch(fixtureUrl)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Не удалось загрузить GeoJSON: ${response.status}`);
    }

    return response.json();
  })
  .then((geojson) => {
    setCount(geojson.features.length);

    const layer = L.geoJSON(geojson, {
      style: {
        color: '#2563eb',
        weight: 1,
        fillColor: '#60a5fa',
        fillOpacity: 0.35,
      },
      onEachFeature(feature, layerItem) {
        layerItem.bindPopup(buildPopup(feature.properties));
      },
    }).addTo(map);

    map.fitBounds(layer.getBounds(), {
      padding: [24, 24],
    });
  })
  .catch((error) => {
    const countNode = document.querySelector('#feature-count');

    if (countNode) {
      countNode.textContent = 'ошибка';
    }

    console.error(error);
  });
