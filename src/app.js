const fixtureUrl = './data/fixtures/old-moscow-sample.geojson';
const pastvuApiUrl = 'https://api.pastvu.com/api2';
const pastvuPhotoPageUrl = 'https://pastvu.com/p/';
const pastvuImageUrl = 'https://pastvu.com/_p/d/';
const yandexMapsUrl = 'https://yandex.ru/maps/';
const yearScale = {
  min: 1357,
  max: 2021,
  periods: [
    { from: 1357, to: 1688, color: '#a61f24' },
    { from: 1689, to: 1916, color: '#bd3f3d' },
    { from: 1917, to: 1923, color: '#d4663f' },
    { from: 1924, to: 1952, color: '#f59a2f' },
    { from: 1953, to: 1963, color: '#cfc366' },
    { from: 1964, to: 1981, color: '#5d8758' },
    { from: 1982, to: 1990, color: '#0f6b68' },
    { from: 1991, to: 2009, color: '#187ca3' },
    { from: 2010, to: 2021, color: '#35a3d1' },
  ],
};

const map = L.map('map', {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([55.751244, 37.618423], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
}).addTo(map);

const buildingPolygonLayer = L.layerGroup().addTo(map);
const pastvuLayer = L.layerGroup().addTo(map);
const emptyValue = 'не указано';
const featureRecords = [];
const yearFilter = {
  from: yearScale.min,
  to: yearScale.max,
};

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

function buildYandexMapsLink(latlng) {
  const lat = latlng.lat.toFixed(6);
  const lng = latlng.lng.toFixed(6);
  const params = new URLSearchParams({
    ll: `${lng},${lat}`,
    text: `${lat} ${lng}`,
    z: '17',
  });

  return `${yandexMapsUrl}?${params.toString()}`;
}

function buildPopup(properties, latlng) {
  const title = formatValue(properties.r_name || properties.r_adress);
  const year = formatValue(properties.r_years_str || properties.r_year_int);
  const address = formatValue(properties.r_adress);
  const floors = formatValue(properties.r_floors);
  const yandexUrl = latlng ? buildYandexMapsLink(latlng) : null;

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
        ${
          yandexUrl
            ? `<div>
                <dt>Карта</dt>
                <dd><a href="${yandexUrl}" target="_blank" rel="noreferrer">Открыть в Яндекс Картах</a></dd>
              </div>`
            : ''
        }
      </dl>
    </article>
  `;
}

function getPeriodColor(year) {
  const period = yearScale.periods.find((item) => year >= item.from && year <= item.to);

  return period?.color || '#64748b';
}

function getFeatureYear(feature) {
  const rawYear = feature.properties.r_year_int;

  if (rawYear === null || rawYear === undefined || rawYear === '') {
    return null;
  }

  const year = Number(rawYear);

  return Number.isFinite(year) ? year : null;
}

function isFeatureVisible(feature) {
  const year = getFeatureYear(feature);

  if (year === null) {
    return yearFilter.from === yearScale.min && yearFilter.to === yearScale.max;
  }

  return year >= yearFilter.from && year <= yearFilter.to;
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

function setSelectedObject(properties, latlng) {
  const selectedNode = document.querySelector('#selected-object');

  if (!selectedNode) {
    return;
  }

  if (!properties) {
    selectedNode.textContent = 'Объект не выбран.';
    return;
  }

  const title = formatValue(properties.r_name || properties.r_adress);
  const year = formatValue(properties.r_years_str || properties.r_year_int);
  const yandexUrl = latlng ? buildYandexMapsLink(latlng) : null;

  selectedNode.innerHTML = `
    <strong>${title}</strong>
    <span>${year}</span>
    ${
      yandexUrl
        ? `<a href="${yandexUrl}" target="_blank" rel="noreferrer">Открыть место в Яндекс Картах</a>`
        : ''
    }
  `;
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
          <a class="photo-card-link" href="${pageUrl}" target="_blank" rel="noreferrer">
            <img src="${imageUrl}" alt="">
            <span class="photo-card-text">
              <span>${title}</span>
              <small>${year}</small>
            </span>
          </a>
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
    year: yearFilter.from,
    year2: yearFilter.to,
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

  setSelectedObject(feature.properties, center);
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

function createBuildingRecord(feature) {
  const year = getFeatureYear(feature);
  const color = year === null ? '#64748b' : getPeriodColor(year);
  const title = formatValue(feature.properties.r_name || feature.properties.r_adress);
  const polygon = L.geoJSON(feature, {
    style: {
      color,
      weight: 1.4,
      fillColor: color,
      fillOpacity: 0.55,
    },
    onEachFeature(item, layerItem) {
      layerItem.bindPopup(buildPopup(item.properties, layerItem.getBounds().getCenter()));
      layerItem.bindTooltip(title, {
        direction: 'top',
        opacity: 0.9,
      });
      layerItem.on('click', () => handleBuildingClick(item, layerItem));
    },
  });

  featureRecords.push({
    feature,
    polygon,
  });
}

function renderBuildings() {
  let visibleCount = 0;

  buildingPolygonLayer.clearLayers();
  pastvuLayer.clearLayers();

  featureRecords.forEach((record) => {
    if (!isFeatureVisible(record.feature)) {
      return;
    }

    record.polygon.addTo(buildingPolygonLayer);
    visibleCount += 1;
  });

  const visibleCountNode = document.querySelector('#visible-feature-count');

  if (visibleCountNode) {
    visibleCountNode.textContent = String(visibleCount);
  }
}

function updateRangeUi() {
  const fromInput = document.querySelector('#year-from');
  const toInput = document.querySelector('#year-to');
  const fromValue = document.querySelector('#year-from-value');
  const toValue = document.querySelector('#year-to-value');
  const activeRange = document.querySelector('#range-active');
  const rangeLength = yearScale.max - yearScale.min;
  const left = ((yearFilter.from - yearScale.min) / rangeLength) * 100;
  const right = 100 - ((yearFilter.to - yearScale.min) / rangeLength) * 100;

  if (fromInput) {
    fromInput.value = String(yearFilter.from);
  }

  if (toInput) {
    toInput.value = String(yearFilter.to);
  }

  if (fromValue) {
    fromValue.textContent = String(yearFilter.from);
  }

  if (toValue) {
    toValue.textContent = String(yearFilter.to);
  }

  if (activeRange) {
    activeRange.style.left = `${left}%`;
    activeRange.style.right = `${right}%`;
  }
}

function handleRangeInput() {
  const fromInput = document.querySelector('#year-from');
  const toInput = document.querySelector('#year-to');

  if (!fromInput || !toInput) {
    return;
  }

  let from = Number(fromInput.value);
  let to = Number(toInput.value);

  if (from > to) {
    [from, to] = [to, from];
  }

  yearFilter.from = from;
  yearFilter.to = to;
  updateRangeUi();
  setSelectedObject(null);
  setPastvuStatus('Выберите объект в выбранном диапазоне годов.');
  renderBuildings();
}

function applyYearPeriod(period) {
  yearFilter.from = period.from;
  yearFilter.to = period.to;
  updateRangeUi();
  setSelectedObject(null);
  setPastvuStatus('Выберите объект в выбранном диапазоне годов.');
  renderBuildings();
}

function setupPeriodFilter() {
  document.querySelectorAll('[data-period-index]').forEach((periodNode) => {
    periodNode.addEventListener('click', () => {
      const period = yearScale.periods[Number(periodNode.dataset.periodIndex)];

      if (period) {
        applyYearPeriod(period);
      }
    });
  });
}

function setupYearFilter() {
  const fromInput = document.querySelector('#year-from');
  const toInput = document.querySelector('#year-to');

  fromInput?.addEventListener('input', handleRangeInput);
  toInput?.addEventListener('input', handleRangeInput);
  setupPeriodFilter();
  updateRangeUi();
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
    setupYearFilter();

    geojson.features.forEach(createBuildingRecord);
    renderBuildings();

    const bounds = L.featureGroup(featureRecords.map((record) => record.polygon)).getBounds();

    map.fitBounds(bounds, {
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
