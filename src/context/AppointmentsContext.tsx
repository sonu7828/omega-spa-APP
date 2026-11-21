/**
 * AppointmentsContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/appointments)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { appointmentsApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface AppointmentServiceItem {
  id: string;
  serviceId: string;
  serviceName: string;
  technicianId?: string;
  technicianName?: string;
  price: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  mainTechnicianId?: string;
  mainTechnicianName?: string;
  date: string;
  time: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  services: AppointmentServiceItem[];
  totalPrice: number;
  notes?: string;
  lateMinutes?: number;
  noShowReason?: string;
  introducedById?: string;
  introducedByName?: string;
  introducedBy?: string;
}

interface AppointmentsContextType {
  appointments: Appointment[];
  loading: boolean;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  technicianFilter: string;
  setTechnicianFilter: (t: string) => void;
  filteredAppointments: Appointment[];
  refreshAppointments: () => Promise<void>;
  createAppointment: (data: any) => Promise<Appointment>;
  updateAppointmentStatus: (id: string, status: string, extraData?: any) => Promise<void>;
  rescheduleAppointment: (id: string, newDate: string, newTime: string) => Promise<void>;
  cancelAppointment: (id: string, reason?: string) => Promise<void>;
  completeService: (appointmentServiceId: string, data?: any) => Promise<void>;
  getAppointment: (id: string) => Appointment | undefined;
  getAppointmentsForDate: (dateStr: string) => Appointment[];
  addAppointment: (data: any) => Promise<Appointment>;
}

const AppointmentsContext = createContext<AppointmentsContextType>({} as AppointmentsContextType);

export const AppointmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [technicianFilter, setTechnicianFilter] = useState<string>('ALL');

  const role = (user?.role || '').toLowerCase();
  const isCleaner = role === 'cleaner';

  const refreshAppointments = useCallback(async () => {
    if (!isAuthenticated || !token || isCleaner) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await appointmentsApi.getAll({ limit: 500 });
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      const mapped = list.map((a: any) => {
        const rawServices = a.appointmentServices || a.services || [];
        const services: AppointmentServiceItem[] = rawServices.map((s: any) => ({
          id: String(s.id),
          serviceId: String(s.serviceId || s.service?.id),
          serviceName: s.service?.name || s.name || 'Spa Service',
          technicianId: s.technicianId || a.mainTechnicianId,
          technicianName:
            s.technician?.staffProfile?.name ||
            s.technician?.name ||
            a.mainTechnician?.staffProfile?.name ||
            'Technician',
          price: Number(s.price || s.service?.price || 0),
          status: (s.status || 'PENDING').toUpperCase(),
        }));

        const total = services.reduce((acc, curr) => acc + curr.price, 0);

        return {
          id: String(a.id),
          clientId: String(a.clientId || a.client?.id),
          clientName: a.client?.name || 'Client',
          clientPhone: a.client?.phone || '',
          mainTechnicianId: a.mainTechnicianId ? String(a.mainTechnicianId) : undefined,
          mainTechnicianName: a.mainTechnician?.staffProfile?.name || a.mainTechnician?.name,
          date: a.appointmentDate ? a.appointmentDate.split('T')[0] : (a.date ? a.date.split('T')[0] : ''),
          time: (a.appointmentTime && a.appointmentTime !== '00:00')
            ? a.appointmentTime
            : (a.time && a.time !== '00:00'
              ? a.time
              : (a.appointmentDate && !a.appointmentDate.includes('00:00:00')
                ? a.appointmentDate.substring(11, 16)
                : (a.appointmentTime || '09:00'))),
          status: (a.status || 'SCHEDULED').toUpperCase() as Appointment['status'],
          services,
          totalPrice: total > 0 ? total : Number(a.totalPrice || 0),
          notes: a.notes,
          lateMinutes: a.lateMinutes,
          noShowReason: a.noShowReason,
          introducedBy: a.introducedBy || a.client?.introducedByEmployee?.name || a.client?.introducedBy || '',
          introducedById: a.introducedById ? String(a.introducedById) : (a.client?.introducedByEmployeeId ? String(a.client?.introducedByEmployeeId) : (a.client?.introducedById ? String(a.client?.introducedById) : undefined)),
          introducedByName: a.introducedByName || a.client?.introducedByEmployee?.name || a.client?.introducedByName || '',
        };
      });
      setAppointments(mapped);
    } catch (e) {
      console.warn('Failed to fetch appointments', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, isCleaner]);

  useEffect(() => {
    if (isAuthenticated && token && !isCleaner) {
      refreshAppointments();
    } else {
      setAppointments([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, isCleaner, refreshAppointments]);

  const createAppointment = async (data: any): Promise<Appointment> => {
    const payload = {
      ...data,
      appointmentDate: data.date || data.appointmentDate,
      appointmentTime: data.time || data.appointmentTime,
    };
    const res = await appointmentsApi.create(payload);
    const newApt = res?.data || res;
    await refreshAppointments();
    return newApt;
  };

  const updateAppointmentStatus = async (id: string, status: string, extraData: any = {}) => {
    await appointmentsApi.updateStatus(id, { status, ...extraData });
    await refreshAppointments();
  };

  const rescheduleAppointment = async (id: string, newDate: string, newTime: string) => {
    await appointmentsApi.reschedule(id, { date: newDate, time: newTime });
    await refreshAppointments();
  };

  const cancelAppointment = async (id: string) => {
    await appointmentsApi.cancel(id);
    await refreshAppointments();
  };

  const completeService = async (appointmentServiceId: string, data: any = {}) => {
    await appointmentsApi.completeService(appointmentServiceId, data);
    await refreshAppointments();
  };

  const getAppointment = (id: string): Appointment | undefined => {
    return appointments.find((a) => String(a.id) === String(id));
  };

  const getAppointmentsForDate = (dateStr: string): Appointment[] => {
    return appointments.filter((a) => a.date === dateStr);
  };

  const filteredAppointments = appointments.filter((a) => {
    if (user?.role === 'technician' && !user?.specialties?.includes('Marketer')) {
      const isMyAppointment =
        String(a.mainTechnicianId) === String(user.id) ||
        a.services.some((s) => String(s.technicianId) === String(user.id));
      if (!isMyAppointment) return false;
    }

    const matchesDate = !selectedDate || a.date === selectedDate;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter.toUpperCase();
    const matchesTech =
      technicianFilter === 'ALL' ||
      String(a.mainTechnicianId) === String(technicianFilter) ||
      a.services.some((s) => String(s.technicianId) === String(technicianFilter));

    return matchesDate && matchesStatus && matchesTech;
  });

  return (
    <AppointmentsContext.Provider
      value={{
        appointments,
        loading,
        selectedDate,
        setSelectedDate,
        statusFilter,
        setStatusFilter,
        technicianFilter,
        setTechnicianFilter,
        filteredAppointments,
        refreshAppointments,
        createAppointment,
        updateAppointmentStatus,
        rescheduleAppointment,
        cancelAppointment,
        completeService,
        getAppointment,
        getAppointmentsForDate,
        addAppointment: createAppointment,
      }}
    >
      {children}
    </AppointmentsContext.Provider>
  );
};

export const useAppointments = () => useContext(AppointmentsContext);
export default AppointmentsContext;
