/**
 * ReportsContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/reports)
 * Exact parity with frontend/src/context/ReportsContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { reportsApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface DashboardMetrics {
  revenueToday: number;
  appointmentsCount: number;
  pendingInvoicesCount: number;
  activeStaffCount: number;
  completedServicesCount: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
}

export interface PaymentMethodBreakdown {
  method: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY' | string;
  amount: number;
  count: number;
}

export interface RevenueReport {
  totalRevenue: number;
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  grossRevenue?: number;
  netRevenue?: number;
}

export interface TechnicianPerformance {
  technicianId: string;
  technicianName: string;
  servicesCompleted: number;
  revenueGenerated: number;
  commissionEarned: number;
  averageTicket?: number;
  clientsReferred?: number;
  appointmentsCreated?: number;
}

interface ReportsContextType {
  metrics: DashboardMetrics;
  dashboardSummary: any;
  revenueReport: RevenueReport | null;
  appointmentAnalytics: any;
  techniciansPerformance: TechnicianPerformance[];
  myPerformance: any;
  loading: boolean;
  period: string;
  setPeriod: (p: string) => void;
  customDateRange: { startDate: string; endDate: string };
  setCustomDateRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  refreshReports: () => Promise<void>;
}

const ReportsContext = createContext<ReportsContextType>({} as ReportsContextType);

export const ReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [period, setPeriod] = useState<string>('today');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [revenueReport, setRevenueReport] = useState<RevenueReport | null>(null);
  const [appointmentAnalytics, setAppointmentAnalytics] = useState<any>(null);
  const [techniciansPerformance, setTechniciansPerformance] = useState<TechnicianPerformance[]>([]);
  const [myPerformance, setMyPerformance] = useState<any>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    revenueToday: 0,
    appointmentsCount: 0,
    pendingInvoicesCount: 0,
    activeStaffCount: 0,
    completedServicesCount: 0,
    topServices: [],
  });
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const isTechnician = role === 'technician';
  const isManager = role === 'manager';
  const isReception = role === 'reception';

  const queryParams = useMemo(() => {
    if (period === 'custom' && customDateRange.startDate && customDateRange.endDate) {
      return {
        period: 'custom',
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
      };
    }
    return period;
  }, [period, customDateRange]);

  const refreshReports = useCallback(async () => {
    if (!isAuthenticated || !token || role === 'cleaner') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isTechnician) {
        const perfRes = await reportsApi.getMyPerformance(queryParams).catch(() => null);
        if (perfRes?.data) setMyPerformance(perfRes.data);
      } else if (isManager || isReception) {
        const [dashRes, revRes, apptRes, techRes] = await Promise.allSettled([
          reportsApi.getDashboard(queryParams),
          reportsApi.getRevenue(queryParams),
          reportsApi.getAppointments(queryParams),
          reportsApi.getTechnicians(queryParams),
        ]);

        if (dashRes.status === 'fulfilled' && dashRes.value) {
          const raw = dashRes.value.data || dashRes.value;
          setDashboardSummary(raw);
          const cards = raw.cards || raw;
          setMetrics({
            revenueToday: Number(cards.totalRevenue || cards.revenue || 0),
            appointmentsCount: Number(cards.totalAppointments || cards.appointmentsCount || 0),
            pendingInvoicesCount: Number(cards.pendingPayments?.count || cards.pendingInvoicesCount || 0),
            activeStaffCount: Number(cards.activeClients || cards.activeStaffCount || 6),
            completedServicesCount: Number(cards.completedServices || 0),
            topServices: raw.topServices || [],
          });
        }

        if (revRes.status === 'fulfilled' && revRes.value?.data) {
          setRevenueReport(revRes.value.data);
        }

        if (apptRes.status === 'fulfilled' && apptRes.value?.data) {
          setAppointmentAnalytics(apptRes.value.data);
        }

        if (techRes.status === 'fulfilled' && techRes.value?.data) {
          const list = techRes.value.data.technicians || techRes.value.data || [];
          setTechniciansPerformance(Array.isArray(list) ? list : []);
        }
      }
    } catch (e) {
      console.warn('Failed to load dashboard metrics', e);
    } finally {
      setLoading(false);
    }
  }, [queryParams, isAuthenticated, token, isTechnician, isManager, isReception, role]);

  useEffect(() => {
    if (isAuthenticated && token && role !== 'cleaner') {
      refreshReports();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, role, refreshReports]);

  return (
    <ReportsContext.Provider
      value={{
        metrics,
        dashboardSummary,
        revenueReport,
        appointmentAnalytics,
        techniciansPerformance,
        myPerformance,
        loading,
        period,
        setPeriod,
        customDateRange,
        setCustomDateRange,
        refreshReports,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
};

export const useReports = () => useContext(ReportsContext);
export default ReportsContext;
