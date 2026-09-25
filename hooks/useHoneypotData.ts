import { useState, useEffect, useCallback } from 'react';
import {
    honeypotServiceV2,
    GetLogEventsV2Params,
    LogEventV2,
    LogStatsV2Response,
    EntityThreatIntelV2,
    LogStatsV2Params
} from '../api/services';
import { handleApiError } from '../api/client';

export interface UseHoneypotDataResult {
    // Data
    events: LogEventV2[];
    stats: LogStatsV2Response | null;
    entityIntel: EntityThreatIntelV2 | null;

    // Loading states
    isLoadingEvents: boolean;
    isLoadingStats: boolean;
    isLoadingEntityIntel: boolean;

    // Error states
    eventsError: string | null;
    statsError: string | null;
    entityIntelError: string | null;

    // Pagination
    total: number;
    limit: number;
    offset: number;

    // Actions
    fetchEvents: (params?: GetLogEventsV2Params) => Promise<void>;
    fetchStats: (params?: LogStatsV2Params) => Promise<void>;
    fetchEntityIntel: (entityId: string) => Promise<void>;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    refresh: () => Promise<void>;
}

export const useHoneypotData = (
    initialParams?: GetLogEventsV2Params
): UseHoneypotDataResult => {
    // State
    const [events, setEvents] = useState<LogEventV2[]>([]);
    const [stats, setStats] = useState<LogStatsV2Response | null>(null);
    const [entityIntel, setEntityIntel] = useState<EntityThreatIntelV2 | null>(null);

    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isLoadingEntityIntel, setIsLoadingEntityIntel] = useState(false);

    const [eventsError, setEventsError] = useState<string | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [entityIntelError, setEntityIntelError] = useState<string | null>(null);

    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(initialParams?.limit || 100);
    const [offset, setOffset] = useState(initialParams?.offset || 0);

    const [currentParams, setCurrentParams] = useState<GetLogEventsV2Params>(
        initialParams || { limit, offset }
    );

    // Fetch events
    const fetchEvents = useCallback(async (params?: GetLogEventsV2Params) => {
        setIsLoadingEvents(true);
        setEventsError(null);

        try {
            const finalParams = params || currentParams;
            const response = await honeypotServiceV2.getLogEvents(finalParams);

            if (response.success) {
                setEvents(response.events);
                setTotal(response.total);
                setLimit(response.limit);
                setOffset(response.offset);
                setCurrentParams(finalParams);
            }
        } catch (err) {
            const error = handleApiError(err);
            setEventsError(error);
            console.error('[useHoneypotData] Events error:', error);
        } finally {
            setIsLoadingEvents(false);
        }
    }, [currentParams]);

    // Fetch stats
    const fetchStats = useCallback(async (params?: LogStatsV2Params) => {
        setIsLoadingStats(true);
        setStatsError(null);

        try {
            const response = await honeypotServiceV2.getLogStats(params);

            if (response.success) {
                setStats(response);
            }
        } catch (err) {
            const error = handleApiError(err);
            setStatsError(error);
            console.error('[useHoneypotData] Stats error:', error);
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    // Fetch entity threat intel
    const fetchEntityIntel = useCallback(async (entityId: string) => {
        setIsLoadingEntityIntel(true);
        setEntityIntelError(null);

        try {
            const response = await honeypotServiceV2.getEntityThreatIntel(entityId);

            if (response.success) {
                setEntityIntel(response);
            }
        } catch (err) {
            const error = handleApiError(err);
            setEntityIntelError(error);
            console.error('[useHoneypotData] Entity intel error:', error);
        } finally {
            setIsLoadingEntityIntel(false);
        }
    }, []);

    // Pagination helpers
    const setPage = useCallback((page: number) => {
        const newOffset = page * limit;
        fetchEvents({ ...currentParams, offset: newOffset, limit });
    }, [limit, currentParams, fetchEvents]);

    const setPageSize = useCallback((size: number) => {
        setLimit(size);
        fetchEvents({ ...currentParams, limit: size, offset: 0 });
    }, [currentParams, fetchEvents]);

    // Refresh all data
    const refresh = useCallback(async () => {
        await Promise.all([
            fetchEvents(currentParams),
            fetchStats({ time_range: '24h' }),
        ]);
    }, [currentParams, fetchEvents, fetchStats]);

    // Initial load
    useEffect(() => {
        fetchEvents(initialParams);
        fetchStats({ time_range: '24h' });
    }, []); // Only run once on mount

    return {
        // Data
        events,
        stats,
        entityIntel,

        // Loading states
        isLoadingEvents,
        isLoadingStats,
        isLoadingEntityIntel,

        // Error states
        eventsError,
        statsError,
        entityIntelError,

        // Pagination
        total,
        limit,
        offset,

        // Actions
        fetchEvents,
        fetchStats,
        fetchEntityIntel,
        setPage,
        setPageSize,
        refresh,
    };
};
