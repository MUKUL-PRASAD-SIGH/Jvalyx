import L from 'leaflet';

/** Simple polyline distance measure — click to add vertices, right-click / Esc to finish. */
export function attachMeasureTool(map: L.Map) {
  let active = false;
  const group = L.layerGroup().addTo(map);
  let points: L.LatLng[] = [];

  function fmt(m: number): string {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
  }

  function total(): number {
    let d = 0;
    for (let i = 1; i < points.length; i += 1) d += points[i - 1].distanceTo(points[i]);
    return d;
  }

  function redraw() {
    group.clearLayers();
    if (points.length === 0) return;
    L.polyline(points, { color: '#38bdf8', weight: 2, dashArray: '5,4' }).addTo(group);
    points.forEach((pt) =>
      L.circleMarker(pt, { radius: 3, color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 1 }).addTo(group),
    );
    if (points.length >= 2) {
      const tip = L.tooltip({ permanent: true, direction: 'top', className: 'firms-measure-tip' })
        .setLatLng(points[points.length - 1])
        .setContent(`${fmt(total())}`);
      group.addLayer(tip as unknown as L.Layer);
    }
  }

  const onClick = (e: L.LeafletMouseEvent) => {
    if (!active) return;
    points.push(e.latlng);
    redraw();
  };
  const onFinish = () => {
    points = [];
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      points = [];
      group.clearLayers();
    }
  };

  map.on('click', onClick);
  map.on('contextmenu', onFinish);
  document.addEventListener('keydown', onKey);

  return {
    setActive(on: boolean) {
      active = on;
      map.getContainer().classList.toggle('firms-measuring', on);
      if (!on) {
        points = [];
        group.clearLayers();
      }
    },
    destroy() {
      map.off('click', onClick);
      map.off('contextmenu', onFinish);
      document.removeEventListener('keydown', onKey);
      map.removeLayer(group);
    },
  };
}
