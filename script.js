// --- Tile conversion utils ---

function latLon2tile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const ytile = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  );
  return { x: xtile, y: ytile };
}

function tile2latLon(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lon_deg = x / n * 360.0 - 180.0;
  const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat_deg = lat_rad * 180.0 / Math.PI;
  return { lat: lat_deg, lon: lon_deg };
}

function tileXYToBounds(x, y, zoom) {
  const topLeft = tile2latLon(x, y, zoom);
  const bottomRight = tile2latLon(x + 1, y + 1, zoom);
  return [[topLeft.lat, topLeft.lon], [bottomRight.lat, bottomRight.lon]];
}

// --- Leaflet map init ---

const map = L.map('map').setView([43.433064, 5.227608], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- Globals ---

let rectangle = null;
let currentCircle = null;
let tempPopup = null;
let cityPopup = null;
let tileOverlays = [];

// --- Bounding box from tile X/Y/Z ---

document.getElementById('submit')?.addEventListener('click', () => {
  const x = parseInt(document.getElementById('x').value, 10);
  const y = parseInt(document.getElementById('y').value, 10);
  const zoom = parseInt(document.getElementById('zoom').value, 10);

  const topLeft = tile2latLon(x, y, zoom);
  const bottomRight = tile2latLon(x + 1, y + 1, zoom);
  const bounds = [[topLeft.lat, topLeft.lon], [bottomRight.lat, bottomRight.lon]];

  if (rectangle) map.removeLayer(rectangle);
  rectangle = L.rectangle(bounds, { color: '#ff7800', weight: 2 }).addTo(map);
  map.fitBounds(bounds);
});

// --- Convert lat/lon to tile ---

document.getElementById('convertLatLon').addEventListener('click', (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById('latInput').value);
  const lon = parseFloat(document.getElementById('lonInput').value);
  const zoom = parseInt(document.getElementById('zoomInput').value, 10);
  const tile = latLon2tile(lat, lon, zoom);

  document.getElementById('tileResult').innerText =
    `Tile Coordinates: X = ${tile.x}, Y = ${tile.y}`;
});

// --- Show bounding box from lat/lon ---

document.getElementById('showBBoxFromLatLon').addEventListener('click', (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById('latInput').value);
  const lon = parseFloat(document.getElementById('lonInput').value);
  const zoom = parseInt(document.getElementById('zoomInput').value, 10);
  const tile = latLon2tile(lat, lon, zoom);

  const topLeft = tile2latLon(tile.x, tile.y, zoom);
  const bottomRight = tile2latLon(tile.x + 1, tile.y + 1, zoom);
  const bounds = [[topLeft.lat, topLeft.lon], [bottomRight.lat, bottomRight.lon]];

  if (rectangle) map.removeLayer(rectangle);
  rectangle = L.rectangle(bounds, { color: '#0078ff', weight: 2 }).addTo(map);
  map.fitBounds(bounds);
  document.getElementById('convertLatLon').click();
});

// --- Draw tiles intersecting with a radius at a given zoom level ---

function drawTilesInCircle(lat, lon, radius, zoom) {
  tileOverlays.forEach(layer => map.removeLayer(layer));
  tileOverlays = [];

  const earthRadius = 6378137;
  const latDelta = (radius / earthRadius) * (180 / Math.PI);
  const lonDelta = latDelta / Math.cos(lat * Math.PI / 180);

  const latMin = lat - latDelta;
  const latMax = lat + latDelta;
  const lonMin = lon - lonDelta;
  const lonMax = lon + lonDelta;

  const tileMin = latLon2tile(latMax, lonMin, zoom);
  const tileMax = latLon2tile(latMin, lonMax, zoom);

  for (let x = tileMin.x; x <= tileMax.x; x++) {
    for (let y = tileMin.y; y <= tileMax.y; y++) {
      const bounds = tileXYToBounds(x, y, zoom);
      const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
      const distance = map.distance([lat, lon], center);

      const tileDiagonal = map.distance(bounds[0], bounds[1]);
      if (distance <= radius + tileDiagonal / 2) {
        const rect = L.rectangle(bounds, {
          color: 'red',
          weight: 1,
          fillOpacity: 0.1
        });

        rect.on('mouseover', function (e) {
          const popup = L.popup()
            .setLatLng(e.latlng)
            .setContent(`Tile x = ${x}<br>Tile y = ${y}<br>Zoom = ${zoom}`)
            .openOn(map);
        });

        rect.on('mouseout', function () {
          map.closePopup();
        });

        rect.addTo(map);
        tileOverlays.push(rect);
      }
    }
  }
}

// --- Show Circle & Tiles button handler ---

document.getElementById('showTilesInCircle').addEventListener('click', () => {
  const lat = parseFloat(document.getElementById('latCircle').value);
  const lon = parseFloat(document.getElementById('lonCircle').value);
  const radius = parseFloat(document.getElementById('radiusInput').value);
  const zoom = parseInt(document.getElementById('zoomRadiusInput').value);

  if (isNaN(lat) || isNaN(lon) || isNaN(radius) || isNaN(zoom)) return;

  if (currentCircle) map.removeLayer(currentCircle);
  currentCircle = L.circle([lat, lon], {
    color: '#4444ff',
    fillColor: '#4444ff',
    fillOpacity: 0.2,
    radius: radius
  }).addTo(map);

  // map.fitBounds(currentCircle.getBounds());
  drawTilesInCircle(lat, lon, radius, zoom);
});

// --- City Search ---

document.getElementById('searchCity').addEventListener('click', async () => {
  const city = document.getElementById('cityInput').value.trim();
  const resultContainer = document.getElementById('citySearchResult');
  if (!city) {
    resultContainer.innerText = 'Please enter a city name.';
    return;
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
    const data = await response.json();

    if (data.length === 0) {
      resultContainer.innerText = 'City not found.';
      return;
    }

    const { lat, lon, display_name } = data[0];
    document.getElementById('latInput').value = lat;
    document.getElementById('lonInput').value = lon;
    document.getElementById('latCircle').value = lat;
    document.getElementById('lonCircle').value = lon;
    map.setView([lat, lon], 13);

    if (cityPopup) map.closePopup(cityPopup);
    cityPopup = L.popup()
      .setLatLng([lat, lon])
      .setContent(`<strong>${display_name}</strong><br>Lat: ${parseFloat(lat).toFixed(5)}, Lon: ${parseFloat(lon).toFixed(5)}`)
      .openOn(map);

    resultContainer.innerText = '';
  } catch (err) {
    console.error(err);
    resultContainer.innerText = 'Error while searching.';
  }
});

// --- Manual BBox Input ---

document.getElementById('showManualBBox').addEventListener('click', () => {
  const latMin = parseFloat(document.getElementById('latMin').value);
  const latMax = parseFloat(document.getElementById('latMax').value);
  const lonMin = parseFloat(document.getElementById('lonMin').value);
  const lonMax = parseFloat(document.getElementById('lonMax').value);

  if (isNaN(latMin) || isNaN(latMax) || isNaN(lonMin) || isNaN(lonMax)) {
    alert('Please fill in all latitude and longitude fields.');
    return;
  }

  const bounds = [[latMin, lonMin], [latMax, lonMax]];

  if (rectangle) map.removeLayer(rectangle);
  rectangle = L.rectangle(bounds, { color: '#00cc66', weight: 2 }).addTo(map);
  map.fitBounds(bounds);
});

// --- Sync lat/lon inputs on map click ---

map.on('click', function (e) {
  const lat = e.latlng.lat.toFixed(6);
  const lon = e.latlng.lng.toFixed(6);

  document.getElementById('latInput').value = lat;
  document.getElementById('lonInput').value = lon;
  document.getElementById('latCircle').value = lat;
  document.getElementById('lonCircle').value = lon;

  if (tempPopup) map.closePopup(tempPopup);
  tempPopup = L.popup()
    .setLatLng(e.latlng)
    .setContent(`latitude= ${lat}<br>longitude= ${lon}`)
    .openOn(map);
});

map.on('move', () => {
  if (tempPopup) {
    map.closePopup(tempPopup);
    tempPopup = null;
  }
  if (cityPopup) {
    map.closePopup(cityPopup);
    cityPopup = null;
  }
});
