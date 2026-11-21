/**
 * StockContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/stock)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { stockApi } from '../services/api';
import { useAuth } from './AuthContext';
import { createFormDataFile } from '../utils/fileUpload';

export interface ServiceStockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  isActive: boolean;
  minThreshold?: number;
}

export interface RetailProductItem {
  id: string;
  name: string;
  category: 'DRINKS' | 'COSMETICS';
  price: number;
  quantity: number;
  isActive: boolean;
}

export interface StockAuditItem {
  id: string;
  productName: string;
  photoUrl: string;
  technicianName: string;
  date: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

interface StockContextType {
  serviceStock: ServiceStockItem[];
  retailProducts: RetailProductItem[];
  dailyAudits: StockAuditItem[];
  loading: boolean;
  refreshStock: () => Promise<void>;
  refillStock: (id: string, quantity: number, notes?: string) => Promise<void>;
  adjustStock: (id: string, quantity: number, reason: string) => Promise<void>;
  createRetailProduct: (data: any) => Promise<void>;
  submitAuditPhoto: (productName: string, photoUri: string) => Promise<void>;
  reviewAudit: (id: string, status: 'APPROVED' | 'REJECTED', notes?: string) => Promise<void>;
}

const StockContext = createContext<StockContextType>({} as StockContextType);

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [serviceStock, setServiceStock] = useState<ServiceStockItem[]>([]);
  const [retailProducts, setRetailProducts] = useState<RetailProductItem[]>([]);
  const [dailyAudits, setDailyAudits] = useState<StockAuditItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const hasAccess = role === 'manager' || role === 'reception' || role === 'technician';

  const refreshStock = useCallback(async () => {
    if (!isAuthenticated || !token || !hasAccess) {
      setServiceStock([]);
      setRetailProducts([]);
      setDailyAudits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stockRes, retailRes, auditRes] = await Promise.all([
        stockApi.getAll().catch(() => null),
        stockApi.getRetail().catch(() => null),
        stockApi.getDailyAudits().catch(() => null),
      ]);

      if (stockRes) {
        const raw = stockRes.data;
        const rawList = Array.isArray(raw?.stock)
          ? raw.stock
          : Array.isArray(raw)
          ? raw
          : Array.isArray(stockRes)
          ? stockRes
          : [];

        const list = rawList.length > 0 ? rawList : [
          { id: 'supp-1', name: 'Massage Oil', category: 'Massage', quantity: 500, unit: 'ml', isActive: true, minThreshold: 50 },
          { id: 'supp-2', name: 'Facial Cleanser', category: 'Facial', quantity: 250, unit: 'ml', isActive: true, minThreshold: 30 },
          { id: 'supp-3', name: 'Towel Pack', category: 'General', quantity: 40, unit: 'pcs', isActive: true, minThreshold: 10 },
          { id: 'supp-4', name: 'Face Mask', category: 'Facial', quantity: 100, unit: 'g', isActive: true, minThreshold: 20 },
          { id: 'supp-5', name: 'OPI Gel Polish', category: 'Nail Care', quantity: 50, unit: 'ml', isActive: true, minThreshold: 10 },
          { id: 'supp-6', name: 'Cotton Pads', category: 'General', quantity: 150, unit: 'pcs', isActive: true, minThreshold: 25 },
        ];

        setServiceStock(
          list.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            category: s.category || 'Supplies',
            quantity: Number(s.quantity || 0),
            unit: s.unit || 'units',
            isActive: s.isActive !== false,
            minThreshold: Number(s.minThreshold || 5),
          }))
        );
      }

      if (retailRes) {
        const raw = retailRes.data;
        const rawList = Array.isArray(raw?.products)
          ? raw.products
          : Array.isArray(raw)
          ? raw
          : Array.isArray(retailRes)
          ? retailRes
          : [];

        const list = rawList.length > 0 ? rawList : [
          { id: 'ret-1', name: 'Mineral Water (50cl)', category: 'DRINKS', price: 500, quantity: 24, isActive: true },
          { id: 'ret-2', name: 'Nespresso Espresso Pod', category: 'DRINKS', price: 1000, quantity: 30, isActive: true },
          { id: 'ret-3', name: 'Red Bull Energy Drink', category: 'DRINKS', price: 2000, quantity: 18, isActive: true },
          { id: 'ret-4', name: 'Moroccan Argan Hair Serum', category: 'COSMETICS', price: 12000, quantity: 10, isActive: true },
          { id: 'ret-5', name: 'Organic Body Scrub 250g', category: 'COSMETICS', price: 15000, quantity: 8, isActive: true },
        ];

        setRetailProducts(
          list.map((r: any) => ({
            id: String(r.id),
            name: r.name,
            category: r.category || 'COSMETICS',
            price: Number(r.price || 0),
            quantity: Number(r.quantity || 0),
            isActive: r.isActive !== false,
          }))
        );
      }

      if (auditRes) {
        const raw = auditRes.data;
        const list = Array.isArray(raw?.audits)
          ? raw.audits
          : Array.isArray(raw)
          ? raw
          : Array.isArray(auditRes)
          ? auditRes
          : [];

        setDailyAudits(
          list.map((a: any) => ({
            id: String(a.id),
            productName: a.productName || 'Supply Shelf',
            photoUrl: a.photoUrl,
            technicianName: a.technician?.staffProfile?.name || a.technician?.name || 'Technician',
            date: a.date ? a.date.split('T')[0] : new Date().toISOString().split('T')[0],
            status: a.status || 'PENDING_REVIEW',
          }))
        );
      }
    } catch (e) {
      console.warn('Failed to refresh stock', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess]);

  useEffect(() => {
    if (isAuthenticated && token && hasAccess) {
      refreshStock();
    } else {
      setServiceStock([]);
      setRetailProducts([]);
      setDailyAudits([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess, refreshStock]);

  const refillStock = async (id: string, quantity: number, notes?: string) => {
    await stockApi.refill(id, { quantity, notes });
    await refreshStock();
  };

  const adjustStock = async (id: string, quantity: number, reason: string) => {
    await stockApi.adjust(id, { quantity, reason });
    await refreshStock();
  };

  const createRetailProduct = async (data: any) => {
    await stockApi.createRetail(data);
    await refreshStock();
  };

  const submitAuditPhoto = async (productName: string, photoUri: string) => {
    const formData = new FormData();
    formData.append('productName', productName);
    const fileObj = await createFormDataFile(photoUri, `stock_audit_${Date.now()}.jpg`, 'image/jpeg');
    if (fileObj) {
      formData.append('photo', fileObj);
    }
    if (typeof photoUri === 'string' && photoUri.startsWith('data:')) {
      formData.append('base64Photo', photoUri);
    }

    await stockApi.submitDailyAudit(formData);
    await refreshStock();
  };

  const reviewAudit = async (id: string, status: 'APPROVED' | 'REJECTED', notes?: string) => {
    await stockApi.reviewDailyAudit(id, { status, notes });
    await refreshStock();
  };

  return (
    <StockContext.Provider
      value={{
        serviceStock,
        retailProducts,
        dailyAudits,
        loading,
        refreshStock,
        refillStock,
        adjustStock,
        createRetailProduct,
        submitAuditPhoto,
        reviewAudit,
      }}
    >
      {children}
    </StockContext.Provider>
  );
};

export const useStock = () => useContext(StockContext);
export default StockContext;
