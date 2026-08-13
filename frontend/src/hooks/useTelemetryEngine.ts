import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWeather, fetchAQI, fetchMarine, fetchTraffic, fetchGIS, fetchWindGrid, fetchTrains, fetchFlights, fetchYatriStatus, ApiResponse } from '../services/api';
import { WeatherData, AQIData, MarineData, TrafficData, WindGridPoint } from '../types';

export type ApiKey = 'weather' | 'aqi' | 'marine' | 'traffic' | 'gis' | 'wind' | 'trains' | 'flights' | 'yatri';

// ── Rich Call Record for History Logging ──────────────────────────────────────
export interface ApiCallRecord {
  timestamp: Date;
  source: 'live' | 'fallback' | 'cached' | 'empty';
  status: 'OK' | 'ERROR' | 'RATE_LIMITED' | 'FALLBACK';
  latencyMs: number;
  message?: string;
  httpStatus?: number;
  dataSize?: number;
}

export interface ApiStatus {
  enabled: boolean;
  status: 'OK' | 'ERROR' | 'RATE_LIMITED' | 'OFF' | 'FETCHING' | 'FALLBACK';
  lastFetched: Date | null;
  nextFetchIn: number;
  callHistory: ApiCallRecord[];
  totalCalls: number;
  totalErrors: number;
  totalFallbacks: number;
  lastLatencyMs?: number;
  lastSource?: 'live' | 'fallback' | 'cached' | 'empty';
  lastMessage?: string;
}

const MAX_HISTORY = 25;
const POLLING_INTERVAL = 15; // 15 seconds

const makeInitialStatus = (enabled: boolean): ApiStatus => ({
  enabled,
  status: enabled ? 'OK' : 'OFF',
  lastFetched: null,
  nextFetchIn: 0,
  callHistory: [],
  totalCalls: 0,
  totalErrors: 0,
  totalFallbacks: 0,
});

export function useTelemetryEngine(simTime: string | null = null, simStartTime: number | null = null) {
  const [data, setData] = useState({
    weather: null as WeatherData | null,
    aqi: null as AQIData | null,
    marine: null as MarineData | null,
    traffic: null as TrafficData | null,
    gis: null as any,
    wind: [] as WindGridPoint[],
    trains: { type: "FeatureCollection", features: [] } as any,
    flights: { type: "FeatureCollection", features: [] } as any,
    yatri: null as any
  });

  const [statuses, setStatuses] = useState<Record<ApiKey, ApiStatus>>({
    weather: makeInitialStatus(true),
    aqi: makeInitialStatus(true),
    marine: makeInitialStatus(true),
    traffic: makeInitialStatus(true),
    gis: makeInitialStatus(true),
    wind: makeInitialStatus(true),
    trains: makeInitialStatus(true),
    flights: makeInitialStatus(true),
    yatri: makeInitialStatus(true),
  });

  const statusesRef = useRef(statuses);
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  const toggleApi = useCallback((key: ApiKey) => {
    setStatuses(prev => {
      const isCurrentlyEnabled = prev[key].enabled;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          enabled: !isCurrentlyEnabled,
          status: isCurrentlyEnabled ? 'OFF' : 'OK',
          nextFetchIn: isCurrentlyEnabled ? 0 : 0
        }
      };
    });
  }, []);

  const getEffectiveSimTime = useCallback(() => {
    if (!simTime) return null;
    if (!simStartTime) return simTime;
    const elapsedMs = Date.now() - simStartTime;
    const parts = simTime.split(':').map(Number);
    const baseSec = parts[0] * 3600 + parts[1] * 60;
    const currentSec = Math.floor(baseSec + elapsedMs / 1000);
    const h = Math.floor(currentSec / 3600) % 24;
    const m = Math.floor((currentSec % 3600) / 60);
    const s = currentSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [simTime, simStartTime]);

  // ── Core fetch handler that unwraps ApiResponse and logs call history ──────
  const fetchApi = async (key: ApiKey, fetcher: () => Promise<ApiResponse<any>>, dataKey: keyof typeof data) => {
    const currentStatus = statusesRef.current[key];
    if (!currentStatus || !currentStatus.enabled) return;

    setStatuses(prev => ({ ...prev, [key]: { ...prev[key], status: 'FETCHING' } }));
    
    const INTERVALS: Partial<Record<ApiKey, number>> = { flights: 60, wind: 300, gis: 120, trains: 8 };
    const interval = INTERVALS[key] ?? POLLING_INTERVAL;
    
    try {
      const response = await fetcher();
      const callRecord: ApiCallRecord = {
        timestamp: new Date(),
        source: response.source,
        latencyMs: response.latencyMs,
        httpStatus: response.httpStatus,
        message: response.message,
        dataSize: response.dataSize,
        status: 'OK',
      };

      let resolvedStatus: ApiStatus['status'] = 'OK';

      if (response.source === 'fallback') {
        resolvedStatus = 'FALLBACK';
        callRecord.status = 'FALLBACK';
      } else if (response.source === 'empty') {
        // Empty means no data at all (e.g. wind rate limited, trains backend down)
        if (response.message?.toLowerCase().includes('rate limit')) {
          resolvedStatus = 'RATE_LIMITED';
          callRecord.status = 'RATE_LIMITED';
        } else {
          resolvedStatus = 'ERROR';
          callRecord.status = 'ERROR';
        }
      }

      // Only update data if we got something meaningful
      if (response.data !== null && response.data !== undefined) {
        const isEmpty = Array.isArray(response.data) && response.data.length === 0;
        if (!isEmpty || response.source === 'live') {
          setData(prev => ({ ...prev, [dataKey]: response.data }));
        }
      }

      setStatuses(prev => {
        const prevStatus = prev[key];
        const newHistory = [callRecord, ...prevStatus.callHistory].slice(0, MAX_HISTORY);
        return {
          ...prev,
          [key]: {
            ...prevStatus,
            status: resolvedStatus,
            lastFetched: new Date(),
            nextFetchIn: interval,
            callHistory: newHistory,
            totalCalls: prevStatus.totalCalls + 1,
            totalErrors: prevStatus.totalErrors + (callRecord.status === 'ERROR' ? 1 : 0),
            totalFallbacks: prevStatus.totalFallbacks + (callRecord.status === 'FALLBACK' || callRecord.status === 'RATE_LIMITED' ? 1 : 0),
            lastLatencyMs: response.latencyMs,
            lastSource: response.source,
            lastMessage: response.message,
          }
        };
      });
    } catch (e: any) {
      const callRecord: ApiCallRecord = {
        timestamp: new Date(),
        source: 'empty',
        status: 'ERROR',
        latencyMs: 0,
        message: `Unexpected error: ${e?.message || 'Unknown'}`,
      };

      setStatuses(prev => {
        const prevStatus = prev[key];
        const newHistory = [callRecord, ...prevStatus.callHistory].slice(0, MAX_HISTORY);
        return {
          ...prev,
          [key]: {
            ...prevStatus,
            status: 'ERROR',
            nextFetchIn: interval,
            callHistory: newHistory,
            totalCalls: prevStatus.totalCalls + 1,
            totalErrors: prevStatus.totalErrors + 1,
            lastMessage: callRecord.message,
          }
        };
      });
    }
  };

  useEffect(() => {
    // Initial fetch
    const fetchAll = () => {
      fetchApi('weather', fetchWeather, 'weather');
      fetchApi('aqi', fetchAQI, 'aqi');
      fetchApi('marine', fetchMarine, 'marine');
      fetchApi('traffic', fetchTraffic, 'traffic');
      fetchApi('gis', fetchGIS, 'gis');
      fetchApi('wind', fetchWindGrid, 'wind');
      fetchApi('trains', () => fetchTrains(getEffectiveSimTime()), 'trains');
      fetchApi('flights', fetchFlights, 'flights');
      fetchApi('yatri', fetchYatriStatus, 'yatri');
    };
    
    fetchAll();

    // Ticker interval (every 1 second)
    const interval = setInterval(() => {
      setStatuses(prev => {
        const next = { ...prev };
        for (const k in next) {
          const key = k as ApiKey;
          if (next[key].enabled && next[key].status !== 'FETCHING') {
            if (next[key].nextFetchIn > 0) {
              next[key] = { ...next[key], nextFetchIn: next[key].nextFetchIn - 1 };
            }
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Separate effect to trigger fetches when nextFetchIn hits 0
  useEffect(() => {
    const triggerFetches = () => {
      const s = statusesRef.current;
      if (s.weather?.enabled && s.weather.nextFetchIn === 0 && s.weather.status !== 'FETCHING') fetchApi('weather', fetchWeather, 'weather');
      if (s.aqi?.enabled && s.aqi.nextFetchIn === 0 && s.aqi.status !== 'FETCHING') fetchApi('aqi', fetchAQI, 'aqi');
      if (s.marine?.enabled && s.marine.nextFetchIn === 0 && s.marine.status !== 'FETCHING') fetchApi('marine', fetchMarine, 'marine');
      if (s.traffic?.enabled && s.traffic.nextFetchIn === 0 && s.traffic.status !== 'FETCHING') fetchApi('traffic', fetchTraffic, 'traffic');
      if (s.gis?.enabled && s.gis.nextFetchIn === 0 && s.gis.status !== 'FETCHING') fetchApi('gis', fetchGIS, 'gis');
      if (s.wind?.enabled && s.wind.nextFetchIn === 0 && s.wind.status !== 'FETCHING') fetchApi('wind', fetchWindGrid, 'wind');
      if (s.trains?.enabled && s.trains.nextFetchIn === 0 && s.trains.status !== 'FETCHING') fetchApi('trains', () => fetchTrains(getEffectiveSimTime()), 'trains');
      if (s.flights?.enabled && s.flights.nextFetchIn === 0 && s.flights.status !== 'FETCHING') fetchApi('flights', fetchFlights, 'flights');
      if (s.yatri?.enabled && s.yatri.nextFetchIn === 0 && s.yatri.status !== 'FETCHING') fetchApi('yatri', fetchYatriStatus, 'yatri');
    };
    
    const interval = setInterval(triggerFetches, 500);
    return () => clearInterval(interval);
  }, [simTime, simStartTime, getEffectiveSimTime]);

  // If simTime changes, immediately fetch trains and reset the timer
  useEffect(() => {
    if (statuses.trains.enabled) {
      setStatuses(prev => ({
        ...prev,
        trains: { ...prev.trains, nextFetchIn: 0 }
      }));
    }
  }, [simTime]);

  return { data, statuses, toggleApi };
}
