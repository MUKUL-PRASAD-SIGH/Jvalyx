/** Tiny typed event bus so UI outside the map can command it (fly-to, geolocate, capture). */
type MapEvents = {
  flyTo: { lat: number; lon: number; zoom?: number };
  geolocate: void;
  capture: void;
  fitIndia: void;
  zoomIn: void;
  zoomOut: void;
  toggleMeasure: boolean;
};

type Handler<K extends keyof MapEvents> = (payload: MapEvents[K]) => void;

class MapBus {
  private handlers: { [K in keyof MapEvents]?: Set<Handler<K>> } = {};

  on<K extends keyof MapEvents>(event: K, handler: Handler<K>): () => void {
    (this.handlers[event] ??= new Set() as never).add(handler as never);
    return () => this.handlers[event]?.delete(handler as never);
  }

  emit<K extends keyof MapEvents>(event: K, payload: MapEvents[K]): void {
    this.handlers[event]?.forEach((h) => (h as Handler<K>)(payload));
  }
}

export const mapBus = new MapBus();
