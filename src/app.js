const fixtureUrl = './data/fixtures/old-moscow-sample.geojson';
const pastvuApiUrl = 'https://api.pastvu.com/api2';
const pastvuPhotoPageUrl = 'https://pastvu.com/p/';
const pastvuImageUrl = 'https://pastvu.com/_p/d/';

const map = L.map('map', {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([55.751244, 37.618423], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const buildingPointLayer = L.layerGroup().addTo(map);
const pastvuLayer = L.layerGroup().addTo(map);
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

function formatYear(year, year2) {
  if (year === null || year === undefined || year === '') {
    return emptyValue;
  }

  if (year2 === null || year2 === undefined || year2 === '' || year === year2) {
    return formatValue(year);
  }

  return `${formatValue(year)}—${formatValue(year2)}`;
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

function buildPhotoPopup(photo) {
  const title = formatValue(photo.title);
  const year = formatYear(photo.year, photo.year2);
  const url = `${pastvuPhotoPageUrl}${encodeURIComponent(photo.cid)}`;

  return `
    <article class="popup">
      <h3>${title}</h3>
      <dl>
        <div>
          <dt>Год</dt>
          <dd>${year}</dd>
        </div>
        <div>
          <dt>PastVu</dt>
          <dd><a href="${url}" target="_blank" rel="noreferrer">Открыть фото</a></dd>
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

function setPastvuStatus(message) {
  const resultsNode = document.querySelector('#pastvu-results');

  if (resultsNode) {
    resultsNode.textContent = message;
  }
}

function setSelectedObject(properties) {
  const selectedNode = document.querySelector('#selected-object');
  const title = formatValue(properties.r_name || properties.r_adress);
  const year = formatValue(properties.r_years_str || properties.r_year_int);

  if (selectedNode) {
    selectedNode.innerHTML = `<strong>${title}</strong><span>${year}</span>`;
  }
}

function renderPastvuPhotos(photos) {
  const resultsNode = document.querySelector('#pastvu-results');

  if (!resultsNode) {
    return;
  }

  if (!photos.length) {
    resultsNode.textContent = 'Рядом не найдено публичных фотографий.';
    return;
  }

  resultsNode.innerHTML = photos
    .map((photo) => {
      const title = formatValue(photo.title);
      const year = formatYear(photo.year, photo.year2);
      const pageUrl = `${pastvuPhotoPageUrl}${encodeURIComponent(photo.cid)}`;
      const imageUrl = `${pastvuImageUrl}${encodeURI(photo.file)}`;

      return `
        <article class="photo-card">
          <a href="${pageUrl}" target="_blank" rel="noreferrer">
            <img src="${imageUrl}" alt="">
            <span>${title}</span>
          </a>
          <small>${year}</small>
        </article>
      `;
    })
    .join('');
}

function addPastvuMarkers(photos) {
  pastvuLayer.clearLayers();

  photos.forEach((photo) => {
    if (!Array.isArray(photo.geo) || photo.geo.length < 2) {
      return;
    }

    L.circleMarker([photo.geo[0], photo.geo[1]], {
      radius: 5,
      color: '#b91c1c',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 0.8,
    })
      .bindPopup(buildPhotoPopup(photo))
      .addTo(pastvuLayer);
  });
}

async function loadNearestPastvuPhotos(latlng) {
  const params = {
    geo: [latlng.lat, latlng.lng],
    distance: 200,
    limit: 5,
  };
  const url = `${pastvuApiUrl}?method=photo.giveNearestPhotos&params=${encodeURIComponent(JSON.stringify(params))}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PastVu API вернул HTTP ${response.status}`);
  }

  const body = await response.json();

  if (body.code) {
    throw new Error(`PastVu API вернул ошибку ${body.code}`);
  }

  return body.result?.photos || body.result || [];
}

async function handleBuildingClick(feature, layerItem) {
  const center = layerItem.getBounds().getCenter();

  setSelectedObject(feature.properties);
  setPastvuStatus('Ищу ближайшие фотографии...');

  try {
    const photos = await loadNearestPastvuPhotos(center);

    renderPastvuPhotos(photos);
    addPastvuMarkers(photos);
  } catch (error) {
    pastvuLayer.clearLayers();
    setPastvuStatus('Не удалось загрузить фотографии PastVu.');
    console.error(error);
  }
}

function addBuildingPoint(feature, layerItem) {
  const center = layerItem.getBounds().getCenter();
  const title = formatValue(feature.properties.r_name || feature.properties.r_adress);

  L.circleMarker(center, {
    radius: 4,
    color: '#1d4ed8',
    weight: 1,
    fillColor: '#2563eb',
    fillOpacity: 0.85,
  })
    .bindTooltip(title, {
      direction: 'top',
      opacity: 0.9,
    })
    .on('click', () => handleBuildingClick(feature, layerItem))
    .addTo(buildingPointLayer);
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
        layerItem.on('click', () => handleBuildingClick(feature, layerItem));
        addBuildingPoint(feature, layerItem);
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
