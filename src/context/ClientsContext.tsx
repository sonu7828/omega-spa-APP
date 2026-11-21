/**
 * ClientsContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/clients)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clientsApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface Client {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  quartier?: string;
  birthday?: string;
  anniversary?: string;
  source?: string;
  clientSource?: string;
  status: 'ACTIVE' | 'VIP' | 'INACTIVE';
  isActive?: boolean;
  totalVisits: number;
  totalSpent: number;
  totalSpend?: number;
  lastVisit?: string;
  introducedById?: string;
  introducedByName?: string;
  introducedBy?: string;
  firstAppointmentService?: string;
  referredByClientId?: string;
  noShowCount?: number;
  noShows?: number;
  history?: any[];
  media?: any[];
  appointments?: any[];
  serviceHistory?: any[];
  photos?: any[];
  loyaltyBalance?: number;
}

interface ClientsContextType {
  clients: Client[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  filteredClients: Client[];
  refreshClients: () => Promise<void>;
  searchClientsApi: (query: string) => Promise<Client[]>;
  addClient: (data: Partial<Client>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<Client>;
  getClient: (id: string) => Client | undefined;
  fetchClientFull: (id: string) => Promise<Client | null>;
  addClientMedia: (clientId: string, mediaData: any) => Promise<any>;
  toggleClientStatus: (id: string) => Promise<void>;
  setClientStatus: (id: string, status: string) => Promise<void>;
}

function mapBackendClient(c: any): Client {
  const isAct = c.status ? c.status.toUpperCase() !== 'INACTIVE' : c.isActive !== false;
  const introId = c.introducedByEmployeeId || c.introducedById;
  const introName =
    c.introducedByEmployee?.staffProfile?.name ||
    c.introducedByEmployee?.name ||
    c.introducedByEmployee?.email ||
    c.introducedByName ||
    c.introducedBy;
  const spent = Number(c.totalSpent || c.totalSpend || 0);
  const ns = Number(c.noShowCount || c.noShows || 0);

  // Map backend history to UI rows
  const rawHistory = c.history || [];
  const mappedHistory = rawHistory
    .filter((h: any) =>
      ['SERVICE_COMPLETED', 'PAYMENT_RECEIVED', 'APPOINTMENT_CREATED', 'STATUS_CHANGED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_UPDATED'].includes(h.action)
    )
    .map((h: any, idx: number) => {
      const dateStr = h.createdAt
        ? new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      const isCancelled = h.action === 'APPOINTMENT_CANCELLED';
      return {
        id: h.id || `hist-${idx}`,
        date: dateStr,
        service: h.details || (isCancelled ? 'Cancelled Appointment' : h.action.replace(/_/g, ' ')),
        technician: isCancelled ? 'Front Desk' : (h.action === 'SERVICE_COMPLETED' ? 'Technician' : 'Front Desk'),
        product: isCancelled ? 'Cancelled' : 'Spa Service',
        price: '—',
        status: isCancelled ? 'cancelled' : 'completed',
        rawAction: h.action,
        rawDetails: h.details,
      };
    });

  // Map backend appointments to UI rows if present
  const rawAppointments = c.appointments || [];
  const mappedApptHistory = rawAppointments.map((a: any, idx: number) => {
    const dateStr = a.appointmentDate
      ? new Date(a.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : (a.date ? new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
    const serviceName =
      a.serviceSummary ||
      a.appointmentServices?.map((s: any) => s.service?.name || s.name).filter(Boolean).join(', ') ||
      'Spa Service';
    const techName =
      a.mainTechnician?.staffProfile?.name ||
      a.appointmentServices?.[0]?.technician?.staffProfile?.name ||
      'Technician';
    const totalPrice =
      a.appointmentServices?.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0) || 0;
    const lowerStatus = String(a.status || 'scheduled').toLowerCase().replace(/_/g, '-');
    return {
      id: a.id || `apt-${idx}`,
      appointmentId: a.id,
      date: dateStr,
      time: a.appointmentTime || a.time || '',
      service: serviceName,
      technician: techName,
      product: lowerStatus === 'cancelled' ? 'Cancelled' : 'Spa Service',
      price: totalPrice > 0 ? totalPrice.toLocaleString('en-US') : '—',
      status: lowerStatus,
      rawStatus: a.status,
      notes: a.notes,
    };
  });

  const combinedHistory = [...mappedApptHistory];
  for (const h of mappedHistory) {
    if (!combinedHistory.some((item) => item.date === h.date && item.status === h.status)) {
      combinedHistory.push(h);
    }
  }

  // Group backend media into cohesive Before / After session cards
  const rawMedia = c.media || [];
  const sessionMap = new Map();
  for (const m of rawMedia) {
    const serviceName = (m.note || 'Service Session').trim();
    const dateStr = m.createdAt
      ? new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Today';
    const key = `${serviceName}___${dateStr}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        id: m.id,
        sessionKey: key,
        service: serviceName,
        date: dateStr,
        before: null,
        after: null,
        beforeId: null,
        afterId: null,
      });
    }
    const session = sessionMap.get(key);
    if (m.mediaType === 'BEFORE') {
      session.before = m.fileUrl;
      session.beforeId = m.id;
    } else if (m.mediaType === 'AFTER') {
      session.after = m.fileUrl;
      session.afterId = m.id;
    }
  }
  const mappedPhotos = Array.from(sessionMap.values());

  return {
    id: String(c.id),
    name: c.name || 'Unknown',
    phone: c.phone || '',
    whatsapp: c.whatsapp || c.phone || '',
    quartier: c.quartier || '',
    birthday: c.birthday ? String(c.birthday).split('T')[0] : '',
    anniversary: c.anniversary ? String(c.anniversary).split('T')[0] : '',
    source: c.source || 'WALK_IN',
    clientSource: c.source === 'STAFF_REFERRAL' || c.introducedByEmployee || introName ? 'Staff Referral' : (c.source || 'Direct'),
    status: (c.status || (isAct ? 'ACTIVE' : 'INACTIVE')).toUpperCase() as Client['status'],
    isActive: isAct,
    totalVisits: Number(c.totalVisits || c._count?.appointments || c.appointmentsCount || 0),
    totalSpent: spent,
    totalSpend: spent,
    lastVisit: c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '—',
    introducedById: introId,
    introducedByName: introName,
    introducedBy: introName || introId,
    firstAppointmentService: c.firstAppointmentService || null,
    referredByClientId: c.referredByClientId,
    noShowCount: ns,
    noShows: ns,
    history: c.history || [],
    media: c.media || [],
    appointments: c.appointments || [],
    serviceHistory: combinedHistory.length > 0 ? combinedHistory : (c.serviceHistory || []),
    photos: mappedPhotos.length > 0 ? mappedPhotos : (c.photos || []),
    loyaltyBalance: Number(c.loyalty?.balance || c.loyaltyPoints || 0),
  };
}

const ClientsContext = createContext<ClientsContextType>({} as ClientsContextType);

export const ClientsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const role = (user?.role || '').toLowerCase();
  const isCleaner = role === 'cleaner';

  const refreshClients = useCallback(async () => {
    if (!isAuthenticated || !token || isCleaner) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await clientsApi.getAll({ limit: 500, isActive: 'all' });
      let allFetched = Array.isArray(res?.data) ? [...res.data] : [];
      const pagination = res?.pagination;

      // If backend has multiple pages (e.g., hardcapped at 500 on Railway), fetch remaining pages
      if (pagination && pagination.totalPages > 1 && allFetched.length < pagination.total) {
        const remainingPromises = [];
        for (let p = 2; p <= pagination.totalPages; p++) {
          remainingPromises.push(
            clientsApi.getAll({ page: p, limit: 500, isActive: 'all' })
          );
        }
        const extraResponses = await Promise.all(remainingPromises);
        for (const extra of extraResponses) {
          if (Array.isArray(extra?.data)) {
            allFetched.push(...extra.data);
          }
        }
      }

      const mapped = allFetched.map(mapBackendClient);
      setClients(mapped);
    } catch (e) {
      console.warn('Failed to fetch clients from backend', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, isCleaner]);

  const searchClientsApi = useCallback(async (query: string): Promise<Client[]> => {
    if (!query || !query.trim()) return [];
    try {
      const res = await clientsApi.getAll({ search: query.trim(), limit: 50 });
      const rawList = Array.isArray(res?.data) ? res.data : [];
      const mapped = rawList.map(mapBackendClient);
      // Merge found clients into local client state if not already present
      setClients((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes = mapped.filter((c: Client) => !existingIds.has(c.id));
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
      return mapped;
    } catch (e) {
      console.warn('searchClientsApi error:', e);
      return [];
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && token && !isCleaner) {
      refreshClients();
    } else {
      setClients([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, isCleaner, refreshClients]);

  const addClient = async (data: Partial<Client>): Promise<Client> => {
    const payload: any = {
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp || data.phone,
      quartier: data.quartier,
      source: data.source || 'WALK_IN',
    };

    if (user?.role !== 'manager' && user?.id) {
      payload.introducedByEmployeeId = user.id;
    } else if (data.introducedById) {
      payload.introducedByEmployeeId = data.introducedById;
    }

    const res = await clientsApi.create(payload);
    const newClient = res?.data || res;
    await refreshClients();
    return newClient;
  };

  const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
    const res = await clientsApi.update(id, updates);
    const updated = res?.data || res;
    await refreshClients();
    return updated;
  };

  const getClient = (id: string): Client | undefined => {
    return clients.find((c) => String(c.id) === String(id));
  };

  const fetchClientFull = async (id: string): Promise<Client | null> => {
    try {
      const res = await clientsApi.getById(id);
      const c = res?.data || res;
      if (!c) return null;
      return mapBackendClient(c);
    } catch (e) {
      return getClient(id) || null;
    }
  };

  const addClientMedia = async (clientId: string, mediaData: any) => {
    const res = await clientsApi.addMedia(clientId, mediaData);
    await refreshClients();
    return res;
  };

  const setClientStatus = async (id: string, status: string) => {
    await clientsApi.setStatus(id, status);
    setClients((prev) =>
      prev.map((c) =>
        String(c.id) === String(id)
          ? {
              ...c,
              status: status.toUpperCase() as Client['status'],
              isActive: status.toUpperCase() === 'ACTIVE',
            }
          : c
      )
    );
    await refreshClients();
  };

  const toggleClientStatus = async (id: string) => {
    const target = getClient(id);
    if (!target) return;
    const nextStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await setClientStatus(id, nextStatus);
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.quartier && c.quartier.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' || c.status === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <ClientsContext.Provider
      value={{
        clients,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredClients,
        refreshClients,
        searchClientsApi,
        addClient,
        updateClient,
        getClient,
        fetchClientFull,
        addClientMedia,
        toggleClientStatus,
        setClientStatus,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
};

export const useClients = () => useContext(ClientsContext);
export default ClientsContext;
