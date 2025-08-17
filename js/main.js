// 藤枝市役所あたり
const centerFujieda = [34.8679, 138.2667];
const map = L.map('map', { zoomControl: true }).setView(centerFujieda, 13);

// ---- ベースレイヤ ----
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const gsiStd = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '地図: © 国土地理院'
});

const gsiPhoto = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
  maxZoom: 18,
  attribution: '航空写真: © 国土地理院'
});

let currentBase = osm;
function setBase(layer) {
  if (currentBase) map.removeLayer(currentBase);
  currentBase = layer.addTo(map);
}

// ---- DistortableImage（画像オーバーレイ） ----
let distortable = null;
const fileInput = document.getElementById('file');
const range = document.getElementById('opacity');
const out = document.getElementById('opacityOut');
const btnFit = document.getElementById('fit');
const btnToggle = document.getElementById('toggleHandles');
const btnRemove = document.getElementById('removeImg');

function setOpacity(val){
  out.value = Number(val).toFixed(2);
  if (!distortable) return;
  distortable.setOpacity(parseFloat(val));
}
range.addEventListener('input', (e)=> setOpacity(e.target.value));

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const imgSrc = reader.result; // dataURL
    if (distortable) { map.removeLayer(distortable); distortable = null; }

    const c = map.getCenter();
    const size = 0.02;
    const corners = [
      [c.lat + size, c.lng - size], // 左上
      [c.lat + size, c.lng + size], // 右上
      [c.lat - size, c.lng + size], // 右下
      [c.lat - size, c.lng - size], // 左下
    ];
    distortable = L.distortableImageOverlay(imgSrc, {
      corners, opacity: parseFloat(range.value), selected: true, editable: true,
    }).addTo(map);
    try { map.fitBounds(L.latLngBounds(corners), { padding: [50,50] }); } catch {}
  };
  reader.readAsDataURL(file);
});

btnFit.addEventListener('click', () => {
  if (!distortable) return;
  const b = distortable.getBounds?.();
  if (b) map.fitBounds(b, { padding: [50,50] });
});
btnToggle.addEventListener('click', () => {
  if (!distortable) return;
  const editing = distortable.editing?._enabled;
  if (editing) distortable.editing.disable();
  else distortable.editing.enable();
});
btnRemove.addEventListener('click', () => {
  if (!distortable) return;
  map.removeLayer(distortable); distortable = null;
});

// ---- Leaflet.draw（図形） ----
const drawnItems = new L.FeatureGroup().addTo(map);
const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems },
  draw: {
    polyline: true, polygon: true, rectangle: true, circle: true, marker: true, circlemarker: false
  }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);
});
map.on('draw:edited', () => {});
map.on('draw:deleted', () => {});

// Export GeoJSON
document.getElementById('export').addEventListener('click', () => {
  const gj = drawnItems.toGeoJSON();
  const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'drawn.geojson';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Import GeoJSON
document.getElementById('import').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const layer = L.geoJSON(data);
      layer.eachLayer(l => drawnItems.addLayer(l));
      try { map.fitBounds(layer.getBounds(), { padding: [40,40] }); } catch {}
    } catch (err) { alert('GeoJSONの読み込みに失敗しました'); }
  };
  reader.readAsText(file, 'utf-8');
});

// ---- 簡易検索（Nominatim） ----
async function geocode(q) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'ja' } });
  if (!res.ok) throw new Error('Geocoding failed');
  const arr = await res.json();
  return arr[0];
}
document.getElementById('search').addEventListener('click', async () => {
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  try {
    const r = await geocode(q);
    if (!r) { alert('見つかりませんでした'); return; }
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    map.setView([lat, lon], 16);
    L.marker([lat, lon]).addTo(map).bindPopup(r.display_name).openPopup();
  } catch (e) { alert('検索に失敗しました'); }
});

// ---- ベース切替ボタン ----
document.getElementById('base-osm').addEventListener('click', () => setBase(osm));
document.getElementById('base-gsi').addEventListener('click', () => setBase(gsiStd));
document.getElementById('base-photo').addEventListener('click', () => setBase(gsiPhoto));