const pastvuApiUrl = 'https://api.pastvu.com/api2';
const pastvuPhotoPageUrl = 'https://pastvu.com/p/';
const pastvuImageUrl = 'https://pastvu.com/_p/d/';
const yandexMapsUrl = 'https://yandex.ru/maps/';
const fixtureDirectoryUrl = './data/fixtures/old-moscow-periods/';
const searchIndexUrl = './data/search-index.json';
const yearScale = {
  min: 1357,
  max: 2021,
  periods: [
    { from: 1357, to: 1688, color: '#a61f24', count: 109, file: 'old-moscow-1357-1688.geojson' },
    { from: 1689, to: 1916, color: '#bd3f3d', count: 6148, file: 'old-moscow-1689-1916.geojson' },
    { from: 1917, to: 1923, color: '#d4663f', count: 3922, file: 'old-moscow-1917-1923.geojson' },
    { from: 1924, to: 1952, color: '#f59a2f', count: 11976, file: 'old-moscow-1924-1952.geojson' },
    { from: 1953, to: 1963, color: '#cfc366', count: 19963, file: 'old-moscow-1953-1963.geojson' },
    { from: 1964, to: 1981, color: '#5d8758', count: 32823, file: 'old-moscow-1964-1981.geojson' },
    { from: 1982, to: 1990, color: '#0f6b68', count: 11648, file: 'old-moscow-1982-1990.geojson' },
    { from: 1991, to: 2009, color: '#187ca3', count: 21074, file: 'old-moscow-1991-2009.geojson' },
    { from: 2010, to: 2021, color: '#35a3d1', count: 2935, file: 'old-moscow-2010-2021.geojson' },
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
const totalFeatureCount = yearScale.periods.reduce((sum, period) => sum + period.count, 0);
const featureRecords = [];
const loadedPeriodIndexes = new Set();
const loadingPeriodPromises = new Map();
let searchIndexPromise;
let renderRequestId = 0;
const yearFilter = {
  from: 1917,
  to: 1956,
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

function getSafeExternalUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatExternalLink(value, label) {
  const url = getSafeExternalUrl(value);

  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`
    : '';
}

function formatSasinSourceLinks(value) {
  if (!Array.isArray(value)) {
    return '';
  }

  const links = value
    .map((source) => {
      const url = getSafeExternalUrl(source?.url);
      const title = source?.title || 'Статья Дмитрия Сасина';

      return url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${formatValue(title)}</a>`
        : '';
    })
    .filter(Boolean);

  return links.join('<br>');
}

function getBuildingPhotoUrl(value) {
  const url = getSafeExternalUrl(value);

  if (!url) {
    return null;
  }

  const photoUrl = new URL(url);
  photoUrl.protocol = 'https:';

  const isWikimediaPhoto =
    photoUrl.hostname.endsWith('wikimedia.org') &&
    (photoUrl.hostname.startsWith('upload.') || photoUrl.pathname.startsWith('/wiki/Special:FilePath/'));
  const isMoscowHeritagePhoto =
    photoUrl.hostname === 'okn-mk.mkrf.ru' && /^\/maps\/show\/id\/\d+\/?$/.test(photoUrl.pathname);
  const hasImageExtension = /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(photoUrl.pathname);

  return isWikimediaPhoto || isMoscowHeritagePhoto || hasImageExtension ? photoUrl.href : null;
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

function formatFloors(value) {
  const floors = Number(value);

  if (!Number.isInteger(floors) || floors < 0) {
    return formatValue(value);
  }

  const lastTwoDigits = floors % 100;
  const lastDigit = floors % 10;
  let unit = 'этажей';

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      unit = 'этаж';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      unit = 'этажа';
    }
  }

  return `${floors} ${unit}`;
}

function hasFloorsValue(value) {
  const floors = Number(value);

  return Number.isInteger(floors) && floors > 0;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^а-яa-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function startsWithSearchTokens(text, tokens) {
  const words = text.split(' ');

  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

function buildYandexMapsLink(latlng, address) {
  const lat = latlng.lat.toFixed(6);
  const lng = latlng.lng.toFixed(6);
  const params = new URLSearchParams({
    ll: `${lng},${lat}`,
    text: address ? `${address}, Москва` : `${lat} ${lng}`,
    z: '17',
  });

  return `${yandexMapsUrl}?${params.toString()}`;
}

function buildPopup(properties, latlng) {
  const rawTitle = properties.r_name || properties.r_adress;
  const rawAddress = properties.r_adress;
  const title = formatValue(rawTitle);
  const year = formatValue(properties.r_years_str || properties.r_year_int);
  const address = formatValue(rawAddress);
  const hasFloors = hasFloorsValue(properties.r_floors);
  const floors = formatFloors(properties.r_floors);
  const hasDistinctAddress =
    rawTitle && rawAddress &&
    String(rawTitle).trim().toLocaleLowerCase('ru') !== String(rawAddress).trim().toLocaleLowerCase('ru');
  const architect = properties.r_architect ? formatValue(properties.r_architect) : '';
  const isApartmentBuilding = Number(properties.isApartmentBuilding) === 1;
  const buildingPhotoUrl = getBuildingPhotoUrl(properties.r_photo_url);
  const kontikiLink = buildingPhotoUrl ? '' : formatExternalLink(properties.r_photo_url, 'Открыть ссылку из Kontiki');
  const wikipediaLink = formatExternalLink(properties.r_wikipedia, 'Открыть статью в Википедии');
  const sasinLinks = formatSasinSourceLinks(properties.r_sasin_sources);
  const yandexUrl = latlng ? buildYandexMapsLink(latlng, rawAddress) : null;

  return `
    <article class="popup">
      <h3>${title}</h3>
      ${
        buildingPhotoUrl
          ? `<a class="popup-image-link" href="${escapeHtml(buildingPhotoUrl)}" target="_blank" rel="noreferrer">
              <img class="popup-image" src="${escapeHtml(buildingPhotoUrl)}" alt="Фотография здания: ${title}">
            </a>`
          : ''
      }
      <dl>
        <div>
          <dt>Год</dt>
          <dd>${year}</dd>
        </div>
        ${
          hasDistinctAddress
            ? `<div>
                <dt>Адрес</dt>
                <dd>${address}</dd>
              </div>`
            : ''
        }
        ${
          hasFloors
            ? `<div>
                <dt>Этажей</dt>
                <dd>${floors}</dd>
              </div>`
            : ''
        }
        ${
          isApartmentBuilding
            ? `<div>
                <dt>Тип</dt>
                <dd>Многоквартирный дом</dd>
              </div>`
            : ''
        }
        ${
          architect
            ? `<div>
                <dt>Архитектор</dt>
                <dd>${architect}</dd>
              </div>`
            : ''
        }
        ${
          kontikiLink
            ? `<div>
                <dt>Материалы</dt>
                <dd>${kontikiLink}</dd>
              </div>`
            : ''
        }
        ${
          wikipediaLink
            ? `<div>
                <dt>Справка</dt>
                <dd>${wikipediaLink}</dd>
              </div>`
            : ''
        }
        ${
          sasinLinks
            ? `<div>
                <dt>Статьи</dt>
                <dd>${sasinLinks}</dd>
              </div>`
            : ''
        }
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
  const yandexUrl = latlng ? buildYandexMapsLink(latlng, properties.r_adress) : null;

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
      layerItem.on('popupopen', () => {
        const popupImage = layerItem.getPopup()?.getElement()?.querySelector('.popup-image');

        popupImage?.addEventListener(
          'error',
          () => {
            popupImage.closest('.popup-image-link')?.remove();
          },
          { once: true }
        );
      });
      layerItem.on('click', () => handleBuildingClick(item, layerItem));
    },
  });

  featureRecords.push({
    feature,
    polygon,
    searchId: feature.properties.__searchId,
    layer: polygon.getLayers()[0],
  });
}

function getRequiredPeriods() {
  return yearScale.periods
    .map((period, index) => ({ ...period, index }))
    .filter((period) => period.from <= yearFilter.to && period.to >= yearFilter.from);
}

async function loadPeriod(period) {
  if (loadedPeriodIndexes.has(period.index)) {
    return;
  }

  if (loadingPeriodPromises.has(period.index)) {
    return loadingPeriodPromises.get(period.index);
  }

  const promise = fetch(`${fixtureDirectoryUrl}${period.file}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Не удалось загрузить GeoJSON: ${response.status}`);
      }

      return response.json();
    })
    .then((geojson) => {
      geojson.features.forEach((feature, featureIndex) => {
        feature.properties.__searchId = `${period.index}:${featureIndex}`;
        createBuildingRecord(feature);
      });
      loadedPeriodIndexes.add(period.index);
    })
    .finally(() => {
      loadingPeriodPromises.delete(period.index);
    });

  loadingPeriodPromises.set(period.index, promise);

  return promise;
}

async function ensureCurrentPeriodsLoaded() {
  const requiredPeriods = getRequiredPeriods();

  if (!requiredPeriods.length) {
    return;
  }

  setPastvuStatus('Загружаю здания выбранного периода...');
  await Promise.all(requiredPeriods.map(loadPeriod));
}

function renderLoadedBuildings() {
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

async function renderBuildings({ fitBounds = false } = {}) {
  const requestId = ++renderRequestId;

  try {
    await ensureCurrentPeriodsLoaded();

    if (requestId !== renderRequestId) {
      return;
    }

    renderLoadedBuildings();
    setPastvuStatus('Выберите объект в выбранном диапазоне годов.');

    if (fitBounds) {
      const visiblePolygons = featureRecords
        .filter((record) => isFeatureVisible(record.feature))
        .map((record) => record.polygon);

      if (visiblePolygons.length) {
        const bounds = L.featureGroup(visiblePolygons).getBounds();

        map.fitBounds(bounds, {
          padding: [24, 24],
        });
      }
    }
  } catch (error) {
    const visibleCountNode = document.querySelector('#visible-feature-count');

    if (visibleCountNode) {
      visibleCountNode.textContent = 'ошибка';
    }

    setPastvuStatus('Не удалось загрузить здания выбранного периода.');
    console.error(error);
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

async function getSearchIndex() {
  if (!searchIndexPromise) {
    searchIndexPromise = fetch(searchIndexUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Не удалось загрузить индекс поиска: ${response.status}`);
        }

        return response.json();
      })
      .then((records) =>
        records.map((record) => ({
          ...record,
          text: normalizeSearchText(`${record.n} ${record.a}`),
          toponymText: normalizeSearchText(record.t),
        }))
      );
  }

  return searchIndexPromise;
}

function formatSearchResultCount(count) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'зданий';
  }

  if (lastDigit === 1) {
    return 'здание';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'здания';
  }

  return 'зданий';
}

function renderSearchResults(groups, query) {
  const resultsNode = document.querySelector('#place-search-results');

  if (!resultsNode) {
    return;
  }

  if (query.length < 2) {
    resultsNode.replaceChildren();
    return;
  }

  const { toponyms, objects, addresses } = groups;

  if (!toponyms.length && !objects.length && !addresses.length) {
    resultsNode.textContent = 'Ничего не найдено.';
    return;
  }

  const renderRecords = (label, records) => {
    if (!records.length) {
      return '';
    }

    return `<section class="place-search-group">
      <p>${label}</p>
      ${records.map((record) => {
      const title = formatValue(record.n || record.a);
      const address = record.n && record.a ? `<small>${formatValue(record.a)}</small>` : '';
      const year = record.y ? `<small>${formatValue(record.y)}</small>` : '';

      return `<button type="button" class="place-search-result" data-search-id="${escapeHtml(record.id)}">
        <span>${title}</span>
        ${address}${year}
      </button>`;
      }).join('')}
    </section>`;
  };
  const toponymGroup = toponyms.length
    ? `<section class="place-search-group">
        <p>Улицы и площади</p>
        ${toponyms.map((toponym) => `<button type="button" class="place-search-result" data-search-toponym="${escapeHtml(toponym.title)}">
          <span>${formatValue(toponym.title)}</span>
          <small>${toponym.count} ${formatSearchResultCount(toponym.count)}</small>
        </button>`).join('')}
      </section>`
    : '';

  resultsNode.innerHTML = `${toponymGroup}${renderRecords('Объекты', objects)}${renderRecords('Адреса', addresses)}`;
}

async function focusSearchResult(result) {
  const period = yearScale.periods[result.p];

  if (!period) {
    return;
  }

  yearFilter.from = period.from;
  yearFilter.to = period.to;
  updateRangeUi();
  await renderBuildings();

  const record = featureRecords.find((item) => item.searchId === result.id);

  if (!record || !record.layer) {
    return;
  }

  const center = record.layer.getBounds().getCenter();
  map.flyTo(center, Math.max(map.getZoom(), 16));
  record.layer.openPopup();
  handleBuildingClick(record.feature, record.layer);
}

async function focusSearchToponym(toponymTitle) {
  const records = await getSearchIndex();
  const toponymText = normalizeSearchText(toponymTitle);
  const matchingRecords = records.filter((record) => record.toponymText === toponymText);

  if (!matchingRecords.length) {
    return;
  }

  const periodIndexes = matchingRecords.map((record) => record.p).filter((periodIndex) => yearScale.periods[periodIndex]);
  const firstPeriod = yearScale.periods[Math.min(...periodIndexes)];
  const lastPeriod = yearScale.periods[Math.max(...periodIndexes)];

  yearFilter.from = firstPeriod.from;
  yearFilter.to = lastPeriod.to;
  updateRangeUi();
  setSelectedObject(null);
  await renderBuildings();
  setPastvuStatus('Выберите объект на выбранной улице.');

  const matchingIds = new Set(matchingRecords.map((record) => record.id));
  const matchingPolygons = featureRecords
    .filter((record) => matchingIds.has(record.searchId))
    .map((record) => record.polygon);

  if (matchingPolygons.length) {
    map.fitBounds(L.featureGroup(matchingPolygons).getBounds(), {
      padding: [32, 32],
    });
  }

  renderSearchResults({
    toponyms: [],
    objects: matchingRecords
      .filter((record) => record.n)
      .sort((left, right) => left.a.localeCompare(right.a, 'ru'))
      .slice(0, 5),
    addresses: matchingRecords
      .sort((left, right) => left.a.localeCompare(right.a, 'ru'))
      .slice(0, 6),
  }, toponymText);
}

function setupPlaceSearch() {
  const input = document.querySelector('#place-search-input');
  const resultsNode = document.querySelector('#place-search-results');
  let requestId = 0;

  input?.addEventListener('input', async () => {
    const query = normalizeSearchText(input.value);
    const currentRequestId = ++requestId;

    if (query.length < 2) {
      renderSearchResults({ toponyms: [], objects: [], addresses: [] }, query);
      return;
    }

    resultsNode.textContent = 'Ищу…';

    try {
      const records = await getSearchIndex();

      if (currentRequestId !== requestId) {
        return;
      }

      const tokens = query.split(' ');
      const matches = records
        .filter((record) => tokens.every((token) => record.text.includes(token)))
        .sort((left, right) => {
          const leftStartsWithQuery = left.text.startsWith(query) ? 0 : 1;
          const rightStartsWithQuery = right.text.startsWith(query) ? 0 : 1;

          return leftStartsWithQuery - rightStartsWithQuery || left.a.localeCompare(right.a, 'ru');
        })
        .slice(0, 40);

      const toponymMap = new Map();

      records
        .filter((record) => record.t && startsWithSearchTokens(record.toponymText, tokens))
        .forEach((record) => {
          const entry = toponymMap.get(record.toponymText) || { title: record.t, count: 0 };

          entry.count += 1;
          toponymMap.set(record.toponymText, entry);
        });

      const toponyms = [...toponymMap.values()]
        .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, 'ru'))
        .slice(0, 5);
      const objects = matches
        .filter((record) => record.n && tokens.every((token) => normalizeSearchText(record.n).includes(token)))
        .slice(0, 5);
      const addresses = matches.slice(0, 6);

      renderSearchResults({ toponyms, objects, addresses }, query);
    } catch (error) {
      resultsNode.textContent = 'Не удалось загрузить поиск.';
      console.error(error);
    }
  });

  resultsNode?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-id]');
    const toponymButton = event.target.closest('[data-search-toponym]');

    if (toponymButton && input) {
      input.value = toponymButton.dataset.searchToponym;
      resultsNode.textContent = 'Показываю здания на улице...';
      focusSearchToponym(toponymButton.dataset.searchToponym).catch((error) => {
        resultsNode.textContent = 'Не удалось показать улицу.';
        console.error(error);
      });
      return;
    }

    if (!button) {
      return;
    }

    getSearchIndex()
      .then((records) => records.find((record) => record.id === button.dataset.searchId))
      .then((result) => result && focusSearchResult(result));
  });
}

setCount(totalFeatureCount);
setupYearFilter();
setupPlaceSearch();
renderBuildings({ fitBounds: true });
