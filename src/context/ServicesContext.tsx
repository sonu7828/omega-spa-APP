/**
 * ServicesContext for OMEGA SPA Mobile
 * Preloads all 66 production services & specialties with zero wipe-out guarantee,
 * and syncs live from Railway backend (/services & /specialties)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { servicesApi, specialtiesApi } from '../services/api';
import { DEFAULT_SERVICES, DEFAULT_SPECIALTIES } from '../data/defaultCatalog';
import { useAuth } from './AuthContext';

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: string;
  numericPrice: number;
  duration: string;
  numericDuration: number;
  description?: string;
  active: boolean;
  status: string;
}

export interface SpecialtyItem {
  id: string;
  name: string;
  active: boolean;
  isActive: boolean;
}

export function formatBackendService(s: any): ServiceItem {
  if (!s) return null as any;
  const numPrice = Number(s.price) || 0;
  const numDur = Number(s.duration) || 45;
  const durStr = numDur > 1 ? `${numDur} min` : (numDur === 1 ? '60 min' : '45 min');
  return {
    id: String(s.id),
    name: s.name || '',
    category: s.category || 'Other',
    price: numPrice.toLocaleString('en-US'),
    numericPrice: numPrice,
    duration: durStr,
    numericDuration: numDur === 1 ? 60 : numDur,
    description: s.description || '',
    active: s.status === 'ACTIVE' || s.isActive === true || s.active === true,
    status: s.status || (s.active ? 'ACTIVE' : 'INACTIVE'),
  };
}

interface ServicesContextType {
  services: ServiceItem[];
  specialties: SpecialtyItem[];
  activeServices: ServiceItem[];
  getActiveServices: () => ServiceItem[];
  loading: boolean;
  refreshServices: () => Promise<void>;
  addService: (data: any) => Promise<any>;
  updateService: (id: string, data: any) => Promise<any>;
  deleteService: (id: string) => Promise<void>;
}

const ServicesContext = createContext<ServicesContextType>({} as ServicesContextType);

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>(DEFAULT_SPECIALTIES as any);
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES as any);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshServices = useCallback(async () => {
    setLoading(true);
    try {
      const [specRes, srvRes] = await Promise.all([
        specialtiesApi.getAll().catch((err: any) => {
          console.warn('Specialties sync note:', err?.message || err);
          return null;
        }),
        servicesApi.getAll().catch((err: any) => {
          console.warn('Services sync note:', err?.message || err);
          return null;
        }),
      ]);

      if (specRes) {
        const rawSpecs = Array.isArray(specRes?.data?.specialties)
          ? specRes.data.specialties
          : Array.isArray(specRes?.data)
          ? specRes.data
          : Array.isArray(specRes)
          ? specRes
          : [];
        if (rawSpecs.length > 0) {
          setSpecialties(
            rawSpecs.map((sp: any) => ({
              id: String(sp.id),
              name: sp.name,
              active: sp.isActive !== false && sp.active !== false,
              isActive: sp.isActive !== false && sp.active !== false,
            }))
          );
        }
      }

      if (srvRes) {
        const rawSrv = Array.isArray(srvRes?.data?.services)
          ? srvRes.data.services
          : Array.isArray(srvRes?.data)
          ? srvRes.data
          : Array.isArray(srvRes)
          ? srvRes
          : [];
        if (rawSrv.length > 0) {
          const formatted = rawSrv.map(formatBackendService).filter(Boolean);
          setServices(formatted);
        }
      }
    } catch (e) {
      console.warn('Failed to refresh services from backend:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync on initial mount immediately
  useEffect(() => {
    refreshServices();
  }, [refreshServices]);

  // Re-sync when auth state or token updates
  useEffect(() => {
    if (isAuthenticated && token) {
      refreshServices();
    }
  }, [isAuthenticated, token, refreshServices]);

  const activeServices = services.filter((s) => s.active);
  const getActiveServices = () => activeServices;

  const addService = async (data: any) => {
    const res = await servicesApi.create(data);
    await refreshServices();
    return res;
  };

  const updateService = async (id: string, data: any) => {
    // 1. Optimistic update in local state so all screens see the new price immediately
    setServices((prev) =>
      prev.map((s) => {
        if (String(s.id) !== String(id)) return s;
        const numPrice = data.price !== undefined ? Number(data.price) : s.numericPrice;
        const numDur = data.duration !== undefined ? Number(data.duration) : s.numericDuration;
        const durStr = numDur > 1 ? `${numDur} min` : (numDur === 1 ? '60 min' : '45 min');
        const isActive =
          data.isActive !== undefined
            ? Boolean(data.isActive)
            : data.status
            ? data.status === 'ACTIVE'
            : s.active;
        return {
          ...s,
          ...(data.name ? { name: data.name } : {}),
          ...(data.category ? { category: data.category } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          numericPrice: numPrice,
          price: numPrice.toLocaleString('en-US'),
          numericDuration: numDur,
          duration: durStr,
          active: isActive,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
        };
      })
    );

    // 2. Persist to Railway backend
    const res = await servicesApi.update(id, data);
    // 3. Confirm with backend re-sync
    await refreshServices();
    return res;
  };

  const deleteService = async (id: string) => {
    setServices((prev) => prev.filter((s) => String(s.id) !== String(id)));
    await servicesApi.delete(id);
    await refreshServices();
  };

  return (
    <ServicesContext.Provider
      value={{
        services,
        specialties,
        activeServices,
        getActiveServices,
        loading,
        refreshServices,
        addService,
        updateService,
        deleteService,
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
};

export const useServices = () => useContext(ServicesContext);
export default ServicesContext;

