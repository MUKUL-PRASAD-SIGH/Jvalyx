import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  ColorMode,
  DataStatus,
  FireDetection,
  LayerState,
  PanelMode,
  ProductId,
  TimeRange,
  TimeWindow,
  ToolId,
} from '../types';
import { DEFAULT_PRODUCTS, FIRE_PRODUCTS } from '../config/products';
import { GIBS_DYNAMIC_IMAGERY } from '../config/gibs';
import { DEFAULT_BASEMAP_ID } from '../config/basemaps';
import { loadDetections } from '../data/firmsClient';

function windowToRange(window: Exclude<TimeWindow, 'custom'>, end = new Date()): TimeRange {
  const hours = window === '24h' ? 24 : window === '48h' ? 48 : 24 * 7;
  return { window, start: new Date(end.getTime() - hours * 3_600_000), end };
}

const initialLayers: LayerState = {
  products: FIRE_PRODUCTS.reduce(
    (acc, p) => {
      acc[p.id] = DEFAULT_PRODUCTS.includes(p.id);
      return acc;
    },
    {} as Record<ProductId, boolean>,
  ),
  gibs: GIBS_DYNAMIC_IMAGERY.reduce(
    (acc, l) => {
      acc[l.id] = { on: false, opacity: 1 };
      return acc;
    },
    {} as Record<string, { on: boolean; opacity: number }>,
  ),
  overlays: { protectedAreas: true, stateBoundaries: true, labels: true },
  fireOpacity: 1,
  colorMode: 'time',
  basemapId: DEFAULT_BASEMAP_ID,
};

export interface FiresState {
  panelMode: PanelMode;
  activeTool: ToolId | null;
  hamburgerOpen: boolean;
  timeRange: TimeRange;
  layers: LayerState;
  detections: FireDetection[];
  dataStatus: DataStatus;
  selectedId: string | null;
  hoveredCoord: { lat: number; lon: number } | null;
  tableOpen: boolean;
  tableProduct: ProductId;
  tableTimezone: 'utc' | 'ist';
  analysisOpen: boolean;
  playing: boolean;
  /** playback cursor as fraction 0..1 across the window; null = full window */
  playhead: number | null;
  /** bump to force a data refetch */
  reloadNonce: number;
}

const initialState: FiresState = {
  panelMode: 'basic',
  activeTool: 'timeline',
  hamburgerOpen: false,
  timeRange: windowToRange('7d'),
  layers: initialLayers,
  detections: [],
  dataStatus: { source: 'loading', message: 'Loading active fire data…', fetchedAt: null, total: 0 },
  selectedId: null,
  hoveredCoord: null,
  tableOpen: false,
  tableProduct: DEFAULT_PRODUCTS[0],
  tableTimezone: 'ist',
  analysisOpen: false,
  playing: false,
  playhead: null,
  reloadNonce: 0,
};

type Action =
  | { type: 'setPanelMode'; mode: PanelMode }
  | { type: 'setTool'; tool: ToolId | null }
  | { type: 'toggleHamburger'; open?: boolean }
  | { type: 'setTimeWindow'; window: Exclude<TimeWindow, 'custom'> }
  | { type: 'setCustomRange'; start: Date; end: Date }
  | { type: 'toggleProduct'; id: ProductId; on?: boolean }
  | { type: 'setFireOpacity'; value: number }
  | { type: 'setColorMode'; mode: ColorMode }
  | { type: 'setBasemap'; id: string }
  | { type: 'toggleGibs'; id: string; on?: boolean }
  | { type: 'setGibsOpacity'; id: string; value: number }
  | { type: 'toggleOverlay'; key: keyof LayerState['overlays']; on?: boolean }
  | { type: 'setData'; detections: FireDetection[]; status: DataStatus }
  | { type: 'setStatus'; status: DataStatus }
  | { type: 'select'; id: string | null }
  | { type: 'hover'; coord: { lat: number; lon: number } | null }
  | { type: 'openTable'; product?: ProductId }
  | { type: 'closeTable' }
  | { type: 'setTableProduct'; id: ProductId }
  | { type: 'setTableTimezone'; tz: 'utc' | 'ist' }
  | { type: 'openAnalysis' }
  | { type: 'closeAnalysis' }
  | { type: 'setPlaying'; playing: boolean }
  | { type: 'setPlayhead'; value: number | null }
  | { type: 'advancePlayhead' }
  | { type: 'reload' };

function reducer(state: FiresState, action: Action): FiresState {
  switch (action.type) {
    case 'setPanelMode':
      return { ...state, panelMode: action.mode };
    case 'setTool':
      return { ...state, activeTool: state.activeTool === action.tool ? null : action.tool };
    case 'toggleHamburger':
      return { ...state, hamburgerOpen: action.open ?? !state.hamburgerOpen };
    case 'setTimeWindow':
      return { ...state, timeRange: windowToRange(action.window), playhead: null };
    case 'setCustomRange':
      return {
        ...state,
        timeRange: { window: 'custom', start: action.start, end: action.end },
        playhead: null,
      };
    case 'toggleProduct': {
      const on = action.on ?? !state.layers.products[action.id];
      return { ...state, layers: { ...state.layers, products: { ...state.layers.products, [action.id]: on } } };
    }
    case 'setFireOpacity':
      return { ...state, layers: { ...state.layers, fireOpacity: action.value } };
    case 'setColorMode':
      return { ...state, layers: { ...state.layers, colorMode: action.mode } };
    case 'setBasemap':
      return { ...state, layers: { ...state.layers, basemapId: action.id } };
    case 'toggleGibs': {
      const cur = state.layers.gibs[action.id] ?? { on: false, opacity: 1 };
      return {
        ...state,
        layers: {
          ...state.layers,
          gibs: { ...state.layers.gibs, [action.id]: { ...cur, on: action.on ?? !cur.on } },
        },
      };
    }
    case 'setGibsOpacity': {
      const cur = state.layers.gibs[action.id] ?? { on: true, opacity: 1 };
      return {
        ...state,
        layers: { ...state.layers, gibs: { ...state.layers.gibs, [action.id]: { ...cur, opacity: action.value } } },
      };
    }
    case 'toggleOverlay':
      return {
        ...state,
        layers: {
          ...state.layers,
          overlays: {
            ...state.layers.overlays,
            [action.key]: action.on ?? !state.layers.overlays[action.key],
          },
        },
      };
    case 'setData':
      return { ...state, detections: action.detections, dataStatus: action.status };
    case 'setStatus':
      return { ...state, dataStatus: action.status };
    case 'select':
      return { ...state, selectedId: action.id };
    case 'hover':
      return { ...state, hoveredCoord: action.coord };
    case 'openTable':
      return { ...state, tableOpen: true, tableProduct: action.product ?? state.tableProduct };
    case 'closeTable':
      return { ...state, tableOpen: false };
    case 'setTableProduct':
      return { ...state, tableProduct: action.id };
    case 'setTableTimezone':
      return { ...state, tableTimezone: action.tz };
    case 'openAnalysis':
      return { ...state, analysisOpen: true };
    case 'closeAnalysis':
      return { ...state, analysisOpen: false };
    case 'setPlaying':
      return { ...state, playing: action.playing, playhead: action.playing ? (state.playhead ?? 0.08) : null };
    case 'setPlayhead':
      return { ...state, playhead: action.value };
    case 'advancePlayhead': {
      const next = state.playhead === null || state.playhead >= 1 ? 0.08 : state.playhead + 0.06;
      return { ...state, playhead: Math.min(1, next) };
    }
    case 'reload':
      return { ...state, reloadNonce: state.reloadNonce + 1 };
    default:
      return state;
  }
}

const StateContext = createContext<FiresState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function FiresProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load / reload detections whenever the enabled products or time window change.
  const enabledKey = FIRE_PRODUCTS.filter((p) => state.layers.products[p.id])
    .map((p) => p.id)
    .join(',');
  const rangeKey = `${state.timeRange.start.toISOString()}|${state.timeRange.end.toISOString()}`;

  useEffect(() => {
    let cancelled = false;
    const products = enabledKey ? (enabledKey.split(',') as ProductId[]) : [];
    const days = Math.max(
      1,
      Math.round((state.timeRange.end.getTime() - state.timeRange.start.getTime()) / 86_400_000),
    );
    dispatch({
      type: 'setStatus',
      status: { source: 'loading', message: 'Loading active fire data…', fetchedAt: null, total: 0 },
    });
    loadDetections({ products, days, endDate: state.timeRange.end })
      .then((res) => {
        if (!cancelled) dispatch({ type: 'setData', detections: res.detections, status: res.status });
      })
      .catch((err) => {
        if (!cancelled)
          dispatch({
            type: 'setStatus',
            status: {
              source: 'error',
              message: err instanceof Error ? err.message : 'Failed to load fire data',
              fetchedAt: new Date(),
              total: 0,
            },
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, rangeKey, state.reloadNonce]);

  // Timeline playback loop — advances the playhead across the window, then loops.
  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setInterval(() => {
      dispatch({ type: 'advancePlayhead' });
    }, 650);
    return () => window.clearInterval(timer);
  }, [state.playing]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useFires(): FiresState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useFires must be used within FiresProvider');
  return ctx;
}

export function useFiresDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useFiresDispatch must be used within FiresProvider');
  return ctx;
}

/** Detections filtered by enabled products + active time range + playback cursor. */
export function useVisibleDetections(): FireDetection[] {
  const { detections, layers, timeRange, playhead } = useFires();
  return useMemo(() => {
    const start = timeRange.start.getTime();
    const fullEnd = timeRange.end.getTime();
    const end = playhead === null ? fullEnd : start + (fullEnd - start) * playhead;
    return detections.filter(
      (d) =>
        layers.products[d.productId] &&
        d.acquiredAt.getTime() >= start &&
        d.acquiredAt.getTime() <= end,
    );
  }, [detections, layers.products, timeRange, playhead]);
}
