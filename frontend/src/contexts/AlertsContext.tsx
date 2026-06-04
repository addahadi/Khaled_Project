import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';

interface Alert {
  alert_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AlertsContextType {
  alerts: Alert[];
  unreadCount: number;
  markRead: (alertId: string) => void;
  markAllRead: () => void;
  refreshAlerts: () => void;
  isLoading: boolean;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAlerts = useCallback(() => {
    setIsLoading(true);
    ApiManager.execute({
      queryKey: ['doctor', 'alerts'],
      endpoint: '/doctor/alerts',
      onSuccess: (data: unknown) => {
        const fetchedAlerts = (data as { alerts: Alert[] }).alerts;
        setAlerts(fetchedAlerts);
        setIsLoading(false);
      },
      onError: () => setIsLoading(false),
    });
  }, []);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  const markRead = (alertId: string) => {
    // Optimistic update
    setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a));
    apiClient.patch(`/doctor/alerts/${alertId}/read`).catch(() => refreshAlerts());
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    apiClient.post('/doctor/alerts/mark-all-read').catch(() => refreshAlerts());
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <AlertsContext.Provider value={{ alerts, unreadCount, markRead, markAllRead, refreshAlerts, isLoading }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
