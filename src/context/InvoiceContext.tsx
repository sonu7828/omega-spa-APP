/**
 * InvoiceContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/invoices & /api/v1/payments)
 * Provides 100% parity with Frontend InvoiceContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { invoicesApi, paymentsApi, whatsappApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface InvoiceItem {
  id: string;
  name: string;
  service?: string;
  type: 'SERVICE' | 'RETAIL';
  price: number;
  quantity: number;
  technicianName?: string;
  productName?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  appointmentId?: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  subtotal: number;
  discount: number;
  total: number;
  finalTotal: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'DRAFT';
  date: string;
  paidAt?: string | null;
  paidTime?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  technicianName?: string;
  items: InvoiceItem[];
  payments: any[];
  notes?: string | null;
}

interface InvoiceContextType {
  invoices: Invoice[];
  pendingInvoices: Invoice[];
  paidTodayInvoices: Invoice[];
  historyInvoices: Invoice[];
  loading: boolean;
  refreshInvoices: () => Promise<void>;
  createInvoiceFromAppointment: (appointmentId: string) => Promise<Invoice>;
  addRetailToInvoice: (invoiceId: string, retailProductId: string, quantity?: number) => Promise<void>;
  collectPayment: (
    invoiceId: string,
    amount: number,
    paymentMethod: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY',
    notes?: string
  ) => Promise<any>;
  recordSplitPayment: (
    invoiceId: string,
    splits: { method: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'; amount: number }[],
    notes?: string,
    discount?: number
  ) => Promise<any>;
  sendWhatsAppReceipt: (invoiceId: string, phone?: string) => Promise<boolean>;
  submitSharedWorkInvoice: (data: { appointmentId: string; clientId?: string; clientName?: string; items: any[] }) => Promise<any>;
  createRetailSaleInvoice: (data: {
    client?: any;
    clientId?: string | null;
    clientName?: string;
    items: any[];
    paymentMethod?: string;
    discount?: number;
    splits?: any[];
  }) => Promise<any>;
  createWalkInServiceInvoice: (data: {
    client?: any;
    clientId?: string | null;
    clientName?: string;
    clientPhone?: string;
    services?: any[];
    retailItems?: any[];
    status?: 'PENDING_PAYMENT' | 'PAID';
    paymentMethod?: string | null;
    splits?: any[];
    notes?: string;
    introducedBy?: string | null;
    introducedById?: string | null;
    discount?: number;
  }) => Promise<any>;
  getInvoice: (id: string) => Invoice | undefined;
  getPaidTodayInvoices: () => Invoice[];
  getPendingInvoices: () => Invoice[];
  getHistoryInvoices: () => Invoice[];
}

const InvoiceContext = createContext<InvoiceContextType>({} as InvoiceContextType);

// Helper to detect if a timestamp is merely midnight UTC or date-only (e.g. "2026-11-02T00:00:00.000Z")
function isMidnightOrDateOnly(t: any): boolean {
  if (!t) return true;
  const str = String(t);
  return str.endsWith('T00:00:00.000Z') || str.endsWith('T00:00:00Z') || /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Format Payment Method helper
export function formatPaymentMethod(method?: string | null): string {
  if (!method) return 'CASH';
  const m = String(method).trim().toUpperCase();
  if (m.includes('+') || m.includes(':')) return m;
  if (m.includes('MTN')) return 'MTN MOMO';
  if (m.includes('ORANGE')) return 'ORANGE MONEY';
  return 'CASH';
}

// Helper to determine if an invoice was paid today
export function isInvoicePaidToday(inv: Invoice): boolean {
  if (inv.status !== 'PAID') return false;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const invDate = inv.date ? String(inv.date).slice(0, 10) : '';
  if (invDate === todayIso || invDate === localToday || invDate === 'Today') return true;

  if (inv.paidAt) {
    const pStr = String(inv.paidAt).slice(0, 10);
    if (pStr === todayIso || pStr === localToday) return true;
  }

  if (Array.isArray(inv.payments) && inv.payments.length > 0) {
    const hasTodayPayment = inv.payments.some((p: any) => {
      const pt = String(p.paidAt || p.createdAt || '').slice(0, 10);
      return pt === todayIso || pt === localToday;
    });
    if (hasTodayPayment) return true;
  }

  if (inv.createdAt) {
    const cStr = String(inv.createdAt).slice(0, 10);
    if (cStr === todayIso || cStr === localToday) return true;
  }

  return false;
}

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const hasAccess = role === 'manager' || role === 'reception' || role === 'technician' || role === 'marketer';

  const refreshInvoices = useCallback(async () => {
    if (!isAuthenticated || !token || !hasAccess) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await invoicesApi.getAll({ limit: 500 });
      const raw = res?.data;
      const list = Array.isArray(raw?.invoices)
        ? raw.invoices
        : Array.isArray(raw)
        ? raw
        : Array.isArray(res)
        ? res
        : [];

      const mapped: Invoice[] = list.map((inv: any) => {
        const rawItems = inv.items || inv.invoiceItems || [];
        const mappedItems: InvoiceItem[] = rawItems.map((item: any) => ({
          id: String(item.id),
          name: item.name || item.service?.name || item.retailProduct?.name || 'Spa Service',
          service: item.name || item.service?.name || 'Spa Service',
          type: item.itemType === 'RETAIL' || item.retailProductId ? 'RETAIL' : 'SERVICE',
          price: Number(item.price || item.unitPrice || 0),
          quantity: Number(item.quantity || item.qty || 1),
          technicianName: item.technician?.staffProfile?.name || item.technician?.name || item.technicianName,
          productName: item.productName || item.product,
        }));

        const firstPayment = inv.payments?.[0];
        let paymentMethodDisplay: string | null = null;
        if (inv.payments && inv.payments.length > 1) {
          paymentMethodDisplay = inv.payments
            .map(
              (p: any) =>
                `${formatPaymentMethod(p.paymentMethod)}: ${Number(p.amount || 0).toLocaleString('en-US')} FCFA`
            )
            .join(' + ');
        } else if (inv.paymentMethod && (inv.paymentMethod.includes('+') || inv.paymentMethod.includes(':'))) {
          paymentMethodDisplay = inv.paymentMethod;
        } else if (firstPayment?.notes && (firstPayment.notes.includes('+') || firstPayment.notes.toLowerCase().includes('split payment:'))) {
          paymentMethodDisplay = firstPayment.notes.replace(/^Split payment:\s*/i, '').trim();
        } else if (firstPayment?.paymentMethod) {
          paymentMethodDisplay = formatPaymentMethod(firstPayment.paymentMethod);
        } else if (inv.paymentMethod) {
          paymentMethodDisplay = formatPaymentMethod(inv.paymentMethod);
        } else if (inv.status === 'PAID') {
          paymentMethodDisplay = 'CASH';
        }

        const rawPaymentTimestamp =
          (!isMidnightOrDateOnly(firstPayment?.paidAt) ? firstPayment?.paidAt : null) ||
          (!isMidnightOrDateOnly(inv.paidAt) ? inv.paidAt : null) ||
          (!isMidnightOrDateOnly(inv.createdAt) ? inv.createdAt : null) ||
          firstPayment?.paidAt ||
          inv.paidAt ||
          null;

        let paidTime: string | null = null;
        if (rawPaymentTimestamp) {
          try {
            paidTime = new Date(rawPaymentTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          } catch (_) {}
        }

        const dateStr = inv.date ? String(inv.date).split('T')[0] : '';
        const totalNum = Number(inv.total || inv.subtotal || 0);
        const discountNum = Number(inv.discount || 0);
        const paidNum = Number(inv.paidAmount ?? (inv.status === 'PAID' ? totalNum : 0));
        const remainingNum = Number(inv.remainingAmount ?? (inv.status === 'PAID' ? 0 : totalNum));

        // Derived technician name
        const firstServiceTech = mappedItems.find(
          (it) => it.type !== 'RETAIL' && it.technicianName && it.technicianName !== 'Staff'
        );
        const mainTechName =
          inv.appointment?.mainTechnician?.staffProfile?.name ||
          inv.appointment?.mainTechnician?.name ||
          firstServiceTech?.technicianName ||
          null;

        const resolvedClientName =
          inv.client?.name && inv.client.name.trim() && inv.client.name.trim().toLowerCase() !== 'client'
            ? inv.client.name.trim()
            : inv.clientName && inv.clientName.trim() && inv.clientName.trim().toLowerCase() !== 'client'
            ? inv.clientName.trim()
            : inv.clientId
            ? 'Client'
            : 'Walk in';

        const resolvedPhone = inv.client?.phone || inv.client?.whatsapp || inv.clientPhone || inv.phone || '';

        return {
          id: String(inv.id),
          invoiceNumber: inv.invoiceNumber || `INV-${String(inv.id).slice(-4)}`,
          appointmentId: inv.appointmentId ? String(inv.appointmentId) : undefined,
          clientId: inv.clientId ? String(inv.clientId) : (inv.client?.id ? String(inv.client.id) : undefined),
          clientName: resolvedClientName,
          clientPhone: resolvedPhone,
          subtotal: Number(inv.subtotal || totalNum),
          discount: discountNum,
          total: totalNum,
          finalTotal: totalNum,
          paidAmount: paidNum,
          remainingAmount: remainingNum,
          status: (inv.status || 'PENDING_PAYMENT').toUpperCase() as Invoice['status'],
          date: dateStr,
          paidAt: rawPaymentTimestamp,
          paidTime,
          paymentMethod: paymentMethodDisplay,
          createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
          technicianName: mainTechName || 'Staff',
          items: mappedItems,
          payments: inv.payments || [],
          notes: inv.notes || inv.appointment?.notes || null,
        };
      });

      setInvoices(mapped);
    } catch (e) {
      console.warn('Failed to fetch invoices', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess]);

  useEffect(() => {
    if (isAuthenticated && token && hasAccess) {
      refreshInvoices();
    } else {
      setInvoices([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess, refreshInvoices]);

  const createInvoiceFromAppointment = async (appointmentId: string): Promise<Invoice> => {
    const res = await invoicesApi.create({ appointmentId });
    await refreshInvoices();
    return res?.data || res;
  };

  const addRetailToInvoice = async (invoiceId: string, retailProductId: string, quantity: number = 1) => {
    await invoicesApi.addRetailItem(invoiceId, { retailProductId, quantity });
    await refreshInvoices();
  };

  const collectPayment = async (
    invoiceId: string,
    amount: number,
    paymentMethod: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY',
    notes?: string
  ) => {
    const res = await paymentsApi.create({
      invoiceId,
      amount,
      paymentMethod,
      notes,
    });
    await refreshInvoices();
    return res;
  };

  const recordSplitPayment = async (
    invoiceId: string,
    splits: { method: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'; amount: number }[],
    notes?: string,
    discount?: number
  ) => {
    if (discount && discount > 0) {
      try {
        await invoicesApi.update(invoiceId, { discount });
      } catch (dErr) {
        console.warn('Discount update on split payment:', dErr);
      }
    }
    for (let i = 0; i < splits.length; i++) {
      const sp = splits[i];
      if (sp.amount > 0) {
        await paymentsApi.create({
          invoiceId,
          amount: sp.amount,
          paymentMethod: sp.method,
          notes: i === 0 ? notes : undefined,
        });
      }
    }
    await refreshInvoices();
  };

  const sendWhatsAppReceipt = async (invoiceId: string, phone?: string): Promise<boolean> => {
    try {
      await whatsappApi.sendInvoicePdf(invoiceId, phone);
      return true;
    } catch (e) {
      console.warn('Failed to send WhatsApp receipt', e);
      return false;
    }
  };

  const submitSharedWorkInvoice = async ({
    appointmentId,
    clientId,
    clientName,
    items,
  }: {
    appointmentId: string;
    clientId?: string;
    clientName?: string;
    items: any[];
  }) => {
    const formattedServices = (items || []).map((it: any) => ({
      serviceId: it.serviceId || null,
      name: it.service || it.name || 'Spa Service',
      price: Number(it.price || 0),
      technicianId: it.technicianId || null,
      technician: it.technician || null,
      quantity: 1,
    }));

    try {
      const res = await invoicesApi.create({
        appointmentId,
        clientId,
        clientName,
        items: formattedServices,
        status: 'PENDING_PAYMENT',
      });
      await refreshInvoices();
      return res;
    } catch (e: any) {
      console.warn('submitSharedWorkInvoice note:', e?.message);
      await refreshInvoices();
      return null;
    }
  };

  const createRetailSaleInvoice = async ({
    client,
    clientId,
    clientName,
    items,
    paymentMethod,
    discount = 0,
    splits = [],
  }: {
    client?: any;
    clientId?: string | null;
    clientName?: string;
    items: any[];
    paymentMethod?: string;
    discount?: number;
    splits?: any[];
  }): Promise<any> => {
    const rawMethod = String(paymentMethod || splits[0]?.paymentMethod || splits[0]?.method || 'CASH').toUpperCase();
    const backendMethod =
      rawMethod.includes('MTN') || rawMethod.includes('MOMO')
        ? 'MTN_MOMO'
        : rawMethod.includes('ORANGE')
        ? 'ORANGE_MONEY'
        : 'CASH';

    const validSplits = (splits || []).filter((s) => Number(s.amount) > 0);
    const isSplit = validSplits.length > 0;
    const backendPayments = isSplit
      ? validSplits.map((s) => {
          const rawM = String(s.method || s.paymentMethod || 'CASH').toUpperCase();
          const bm = rawM.includes('MTN') || rawM.includes('MOMO') ? 'MTN_MOMO' : rawM.includes('ORANGE') ? 'ORANGE_MONEY' : 'CASH';
          return {
            amount: Number(s.amount),
            paymentMethod: bm,
            notes: 'Retail sale split payment',
          };
        })
      : undefined;

    const retailProductsPayload = (items || []).map((it: any) => ({
      retailProductId: String(it.productId || it.id),
      quantity: Math.max(1, parseInt(it.qty, 10) || 1),
    }));

    const resolvedClientId = client?.id || clientId || undefined;
    const resolvedClientName = client?.name || clientName || 'Walk in';
    const resolvedPhone = client?.phone || client?.whatsapp || undefined;

    const res = await invoicesApi.create({
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      clientPhone: resolvedPhone,
      discount: discount || 0,
      status: 'PAID',
      paymentMethod: backendPayments?.[0]?.paymentMethod || backendMethod,
      payments: backendPayments,
      retailProducts: retailProductsPayload,
    });

    await refreshInvoices();
    return res?.data?.invoice || res?.data || res;
  };

  const createWalkInServiceInvoice = async ({
    client,
    clientId,
    clientName,
    clientPhone,
    services = [],
    retailItems = [],
    status = 'PENDING_PAYMENT',
    paymentMethod = 'CASH',
    splits = [],
    notes = '',
    introducedBy = null,
    introducedById = null,
    discount = 0,
  }: {
    client?: any;
    clientId?: string | null;
    clientName?: string;
    clientPhone?: string;
    services?: any[];
    retailItems?: any[];
    status?: 'PENDING_PAYMENT' | 'PAID';
    paymentMethod?: string | null;
    splits?: any[];
    notes?: string;
    introducedBy?: string | null;
    introducedById?: string | null;
    discount?: number;
  }): Promise<any> => {
    const isPaid = status === 'PAID';
    const validSplits = (splits || []).filter((s) => Number(s.amount) > 0);
    const isSplit = isPaid && validSplits.length > 0;

    const rawMethod = String(paymentMethod || validSplits[0]?.paymentMethod || validSplits[0]?.method || 'CASH').toUpperCase();
    const backendMethod =
      rawMethod.includes('MTN') || rawMethod.includes('MOMO')
        ? 'MTN_MOMO'
        : rawMethod.includes('ORANGE')
        ? 'ORANGE_MONEY'
        : 'CASH';

    const backendPayments = isSplit
      ? validSplits.map((s) => {
          const rawM = String(s.method || s.paymentMethod || 'CASH').toUpperCase();
          const bm = rawM.includes('MTN') || rawM.includes('MOMO') ? 'MTN_MOMO' : rawM.includes('ORANGE') ? 'ORANGE_MONEY' : 'CASH';
          return {
            amount: Number(s.amount),
            paymentMethod: bm,
            notes: 'Walk-in service split payment',
          };
        })
      : undefined;

    const resolvedClientId = client?.id || clientId || null;
    const resolvedClientName = client?.name?.trim() || clientName?.trim() || 'Walk in';
    const resolvedPhone = client?.phone || clientPhone || undefined;

    const mappedServices = (services || []).map((s: any) => ({
      serviceId: s.serviceId || null,
      name: String(s.service || s.name || 'Spa Service').trim(),
      price: Math.max(0, Number(s.price) || 0),
      technicianId: s.technicianId || null,
      technician: s.technician || null,
      quantity: 1,
    }));

    const validRetailProducts = (retailItems || []).map((r: any) => ({
      retailProductId: String(r.productId || r.id),
      quantity: Math.max(1, parseInt(r.qty, 10) || 1),
    }));

    const payload: any = {
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      clientPhone: resolvedPhone,
      phone: resolvedPhone,
      status: isPaid ? 'PAID' : 'PENDING_PAYMENT',
      paymentMethod: isPaid ? (backendPayments?.[0]?.paymentMethod || backendMethod) : undefined,
      payments: isPaid ? backendPayments : undefined,
      discount: discount || 0,
      notes: notes || undefined,
      introducedBy: introducedBy || undefined,
      introducedById: introducedById || undefined,
      services: mappedServices,
      ...(validRetailProducts.length > 0 ? { retailProducts: validRetailProducts } : {}),
    };

    const res = await invoicesApi.create(payload);
    await refreshInvoices();
    return res?.data?.invoice || res?.data || res;
  };

  const getInvoice = (id: string): Invoice | undefined => {
    return invoices.find((inv) => String(inv.id) === String(id));
  };

  const pendingInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'PENDING_PAYMENT' || inv.status === 'DRAFT');
  }, [invoices]);

  const paidTodayInvoices = useMemo(() => {
    return invoices.filter((inv) => isInvoicePaidToday(inv));
  }, [invoices]);

  const historyInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'PAID');
  }, [invoices]);

  const getPaidTodayInvoices = useCallback(() => {
    return invoices.filter((inv) => isInvoicePaidToday(inv));
  }, [invoices]);

  const getPendingInvoices = useCallback(() => {
    return invoices.filter((inv) => inv.status === 'PENDING_PAYMENT' || inv.status === 'DRAFT');
  }, [invoices]);

  const getHistoryInvoices = useCallback(() => {
    return invoices.filter((inv) => inv.status === 'PAID');
  }, [invoices]);

  return (
    <InvoiceContext.Provider
      value={{
        invoices,
        pendingInvoices,
        paidTodayInvoices,
        historyInvoices,
        loading,
        refreshInvoices,
        createInvoiceFromAppointment,
        addRetailToInvoice,
        collectPayment,
        recordSplitPayment,
        sendWhatsAppReceipt,
        submitSharedWorkInvoice,
        createRetailSaleInvoice,
        createWalkInServiceInvoice,
        getInvoice,
        getPaidTodayInvoices,
        getPendingInvoices,
        getHistoryInvoices,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoices = () => useContext(InvoiceContext);
export default InvoiceContext;
