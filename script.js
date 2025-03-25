// Convert tile coordinates to lat/lon (top-left corner)
function tile2latLon(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lon_deg = x / n * 360.0 - 180.0;
  const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat_deg = lat_rad * 180.0 / Math.PI;
  return {lat: lat_deg, lon: lon_deg};
}

// Convert lat/lon to tile coordinates
function latLon2tile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const ytile = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 *
      n);
  return {x: xtile, y: ytile};
}

// Initialize map
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
   attribution: '&copy; OpenStreetMap contributors'
 }).addTo(map);

let rectangle = null;  // Stores the bounding box layer

// Show bounding box from X, Y, Zoom
document.getElementById('submit').addEventListener('click', () => {
  const x = parseInt(document.getElementById('x').value, 10);
  const y = parseInt(document.getElementById('y').value, 10);
  const zoom = parseInt(document.getElementById('zoom').value, 10);

  const topLeft = tile2latLon(x, y, zoom);
  const bottomRight = tile2latLon(x + 1, y + 1, zoom);

  const bounds =
      [[topLeft.lat, topLeft.lon], [bottomRight.lat, bottomRight.lon]];

  if (rectangle) map.removeLayer(rectangle);
  rectangle = L.rectangle(bounds, {color: '#ff7800', weight: 2}).addTo(map);
  map.fitBounds(bounds);
});

// Convert lat/lon to tile coordinates
document.getElementById('convertLatLon').addEventListener('click', (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById('latInput').value);
  const lon = parseFloat(document.getElementById('lonInput').value);
  const zoom = parseInt(document.getElementById('zoomInput').value, 10);

  const tile = latLon2tile(lat, lon, zoom);
  document.getElementById('tileResult').innerText =
      `Tile Coordinates: X = ${tile.x}, Y = ${tile.y}`;
});

document.getElementById('showBBoxFromLatLon').addEventListener('click', (e) => {
  e.preventDefault();

  const lat = parseFloat(document.getElementById('latInput').value);
  const lon = parseFloat(document.getElementById('lonInput').value);
  const zoom = parseInt(document.getElementById('zoomInput').value, 10);

  const tile = latLon2tile(lat, lon, zoom);
  const x = tile.x;
  const y = tile.y;

  const topLeft = tile2latLon(x, y, zoom);
  const bottomRight = tile2latLon(x + 1, y + 1, zoom);

  const bounds =
      [[topLeft.lat, topLeft.lon], [bottomRight.lat, bottomRight.lon]];

  if (rectangle) map.removeLayer(rectangle);
  rectangle = L.rectangle(bounds, {color: '#0078ff', weight: 2}).addTo(map);
  map.fitBounds(bounds);
  document.getElementById('convertLatLon').click();
});

let tempPopup = null;
let cityPopup = null;

// On map click: show popup + update lat/lon inputs
map.on('click', function(e) {
  const lat = e.latlng.lat.toFixed(6);
  const lon = e.latlng.lng.toFixed(6);

  // Update input fields
  document.getElementById('latInput').value = lat;
  document.getElementById('lonInput').value = lon;

  // Remove previous popup if it exists
  if (tempPopup) {
    map.closePopup(tempPopup);
  }

  // Create new popup
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

document.getElementById('searchCity').addEventListener('click', async () => {
  const city = document.getElementById('cityInput').value.trim();
  const resultContainer = document.getElementById('citySearchResult');

  if (!city) {
    resultContainer.innerText = 'Please enter a city name.';
    return;
  }

  try {
    const response =
        await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${
            encodeURIComponent(city)}`);
    const data = await response.json();

    if (data.length === 0) {
      resultContainer.innerText = 'City not found.';
      return;
    }

    const {lat, lon, display_name} = data[0];
    // Update input fields
    document.getElementById('latInput').value = lat;
    document.getElementById('lonInput').value = lon;
    map.setView([lat, lon], 13);  // You can change the zoom level if you want

    // Close previous city popup if it exists
    if (cityPopup) {
      map.closePopup(cityPopup);
    }

    // Show new city popup
    cityPopup = L.popup()
                    .setLatLng([lat, lon])
                    .setContent(`<strong>${display_name}</strong><br>Lat: ${
                        parseFloat(lat).toFixed(
                            5)}, Lon: ${parseFloat(lon).toFixed(5)}`)
                    .openOn(map);

    resultContainer.innerText = '';  // Clear previous error
  } catch (err) {
    console.error(err);
    resultContainer.innerText = 'Error while searching.';
  }
});

document.getElementById('cityInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('searchCity').click();
  }
});

// Trigger bbox from X/Y/Z when pressing Enter
['x', 'y', 'zoom'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('submit').click();
    }
  });
});

// Trigger bbox from Lat/Lon/Z when pressing Enter
['latInput', 'lonInput', 'zoomInput'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('showBBoxFromLatLon').click();
    }
  });
});

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
  rectangle = L.rectangle(bounds, {color: '#00cc66', weight: 2}).addTo(map);
  map.fitBounds(bounds);
});
