/**
 * Centralized API Client for OMEGA SPA Mobile App
 * Connects directly to production backend on Railway
 */

import storage from './storage';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://spa-sonu-backend-production-43effb24.up.railway.app/api/v1';

export function toQueryString(params: any = {}): string {
  if (!params) return '';
  if (typeof params === 'string') {
    return params.startsWith('?') ? params : ('?period=' + encodeURIComponent(params));
  }
  if (typeof params !== 'object') return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  unauthorizedHandler = fn;
};


export async function apiRequest(endpoint: string, options: any = {}) {
  const token = await storage.getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : API_BASE_URL + (endpoint.startsWith('/') ? '' : '/') + endpoint;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        data?.message ||
        data?.error ||
        (typeof data === 'string' ? data : 'HTTP ' + response.status);
      if (response.status === 401 || (typeof errorMsg === 'string' && (errorMsg.includes('Invalid or expired token') || errorMsg.includes('Authorization token required')))) {
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (!options?.silent) {
      console.warn('[API Error] ' + (options.method || 'GET') + ' ' + endpoint + ':', error);
    }
    throw error;
  }
}

// 1. Auth Module
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => apiRequest('/auth/me'),
};

// 2. Users / Staff Module
export const usersApi = {
  getAll: () => apiRequest('/users'),
  getById: (id: string) => apiRequest('/users/' + id),
  create: (data: any) =>
    apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, updates: any) =>
    apiRequest('/users/' + id, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    apiRequest('/users/' + id, {
      method: 'DELETE',
    }),
  updateSalaryContract: (id: string, contractData: any) =>
    apiRequest('/users/' + id + '/salary-contract', {
      method: 'PATCH',
      body: JSON.stringify(contractData),
    }),
};

// 3. Specialties Module
export const specialtiesApi = {
  getAll: () => apiRequest('/specialties'),
  getById: (id: string) => apiRequest('/specialties/' + id),
  create: (data: any) =>
    apiRequest('/specialties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, updates: any) =>
    apiRequest('/specialties/' + id, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    apiRequest('/specialties/' + id, {
      method: 'DELETE',
    }),
};

// 4. Services Module
export const servicesApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/services'  + toQueryString(params));
  },
  getById: (id: string) => apiRequest('/services/' + id),
  create: (data: any) =>
    apiRequest('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, updates: any) =>
    apiRequest('/services/' + id, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    apiRequest('/services/' + id, {
      method: 'DELETE',
    }),
};

// 5. Clients Module
export const clientsApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/clients'  + toQueryString(params));
  },
  getById: (id: string) => apiRequest('/clients/' + id),
  create: (clientData: any) =>
    apiRequest('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    }),
  update: (id: string, updates: any) =>
    apiRequest('/clients/' + id, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  setStatus: (id: string, status: string) =>
    apiRequest('/clients/' + id + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  activate: (id: string) =>
    apiRequest('/clients/' + id + '/activate', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  deactivate: (id: string) =>
    apiRequest('/clients/' + id + '/deactivate', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getHistory: (id: string) => apiRequest('/clients/' + id + '/history'),
  addMedia: (clientId: string, mediaData: any) =>
    apiRequest('/clients/' + clientId + '/media', {
      method: 'POST',
      body: JSON.stringify(mediaData),
    }),
  getServiceCompletion: (appointmentServiceId: string) =>
    apiRequest('/service-completion/' + appointmentServiceId),
};

// 6. Appointments Module
export const appointmentsApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/appointments'  + toQueryString(params));
  },
  getById: (id: string) => apiRequest('/appointments/' + id),
  create: (appointmentData: any) =>
    apiRequest('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    }),
  update: (id: string, data: any) =>
    apiRequest('/appointments/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, data: any) =>
    apiRequest('/appointments/' + id + '/status', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changeStatus: (id: string, data: any) =>
    apiRequest('/appointments/' + id + '/status', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  reschedule: (id: string, data: any) =>
    apiRequest('/appointments/' + id + '/reschedule', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  completeService: (appointmentServiceId: string, data: any = {}) =>
    apiRequest('/service-completion/' + appointmentServiceId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancel: (id: string) =>
    apiRequest('/appointments/' + id + '/cancel', {
      method: 'PATCH',
    }),
};

// 7. Invoices Module
export const invoicesApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/invoices'  + toQueryString(params));
  },
  getPending: () => apiRequest('/invoices/pending'),
  getById: (id: string) => apiRequest('/invoices/' + id),
  create: (data: any) => {
    let payload;
    if (typeof data === 'string') {
      payload = { appointmentId: data };
    } else if (data && typeof data === 'object') {
      const isAppointmentObj = Boolean(
        data.appointmentDate || data.serviceSummary || data.appointmentServices
      );
      const rawAptId =
        data.appointmentId !== undefined ? data.appointmentId : isAppointmentObj ? data.id : null;
      const aptId =
        rawAptId && typeof rawAptId === 'object'
          ? rawAptId.appointmentId || rawAptId.id || String(rawAptId)
          : rawAptId;

      payload = {
        ...(data.clientId ? { clientId: data.clientId } : {}),
        ...(data.clientName ? { clientName: data.clientName } : {}),
        ...(data.clientPhone ? { clientPhone: data.clientPhone } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.date ? { date: data.date } : {}),
        ...(data.invoiceNumber ? { invoiceNumber: data.invoiceNumber } : {}),
        discount: typeof data.discount === 'number' ? data.discount : 0,
        status: data.status || 'PENDING_PAYMENT',
        ...(aptId ? { appointmentId: aptId } : {}),
        ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
        ...(Array.isArray(data.payments) && data.payments.length > 0 ? { payments: data.payments } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        ...(data.introducedBy ? { introducedBy: data.introducedBy } : {}),
        ...(data.introducedById ? { introducedById: data.introducedById } : {}),
        ...(Array.isArray(data.retailProducts) && data.retailProducts.length > 0
          ? { retailProducts: data.retailProducts }
          : {}),
        ...(Array.isArray(data.services) && data.services.length > 0
          ? { services: data.services }
          : {}),
      };
    } else {
      payload = data;
    }

    return apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update: (id: string, data: any) =>
    apiRequest('/invoices/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  addRetailItem: (invoiceId: string, data: any) =>
    apiRequest('/invoices/' + invoiceId + '/retail-items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 8. Payments Module
export const paymentsApi = {
  create: (paymentData: any) =>
    apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),
  getAll: (params: any = {}) => {
    return apiRequest('/payments'  + toQueryString(params));
  },
};

// 9. Stock Module (Service + Retail + Daily Audits)
export const stockApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/stock'  + toQueryString(params));
  },
  getById: (id: string) => apiRequest(`/stock/${id}`),
  create: (data: any) =>
    apiRequest('/stock', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  refill: (id: string, refillData: any) =>
    apiRequest(`/stock/${id}/refill`, {
      method: 'POST',
      body: JSON.stringify(refillData),
    }),
  adjust: (id: string, adjustData: any) =>
    apiRequest(`/stock/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(adjustData),
    }),
  update: (id: string, data: any) =>
    apiRequest(`/stock/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getActivity: (params: any = {}) => {
    return apiRequest('/stock/activity'  + toQueryString(params));
  },
  getRetail: () => apiRequest('/stock/retail'),
  createRetail: (data: any) =>
    apiRequest('/stock/retail', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  refillRetail: (id: string, refillData: any) =>
    apiRequest(`/stock/retail/${id}/refill`, {
      method: 'POST',
      body: JSON.stringify(refillData),
    }),
  deductRetail: (data: any) =>
    apiRequest('/stock/retail/deduct', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRetail: (id: string, data: any) =>
    apiRequest(`/stock/retail/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest(`/stock/${id}`, {
      method: 'DELETE',
    }),
  deleteRetail: (id: string) =>
    apiRequest(`/stock/retail/${id}`, {
      method: 'DELETE',
    }),
  submitDailyAudit: (data: any) =>
    apiRequest('/stock/daily-audit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDailyAudits: (params: any = {}, options: any = {}) => {
    return apiRequest('/stock/daily-audit' + toQueryString(params), {
      silent: true,
      ...options,
    });
  },
  reviewDailyAudit: (id: string, reviewData: any) =>
    apiRequest(`/stock/daily-audit/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(reviewData),
    }),
  deleteDailyAudit: (id: string) =>
    apiRequest(`/stock/daily-audit/${id}`, {
      method: 'DELETE',
    }),
};

// 10. Commissions & Payroll Module
export const commissionsApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/commissions'  + toQueryString(params));
  },
  getTechnicianSummary: (technicianId: string) => apiRequest('/commissions/' + technicianId),
  getRules: () => apiRequest('/commissions/rules'),
  saveRule: (ruleData: any) =>
    apiRequest('/commissions/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    }),
  addBonus: (commissionId: string, data: any) =>
    apiRequest('/commissions/' + commissionId + '/bonus', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adjust: (commissionId: string, data: any) =>
    apiRequest('/commissions/' + commissionId + '/adjust', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  approve: (commissionId: string) =>
    apiRequest('/commissions/' + commissionId + '/approve', {
      method: 'POST',
    }),
  getSalarySummary: (params: any = {}) => {
    return apiRequest('/commissions/salary-summary'  + toQueryString(params));
  },
  finalizePayroll: (data: any) =>
    apiRequest('/commissions/payroll/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 11. Loyalty Module
export const loyaltyApi = {
  getSettings: () => apiRequest('/loyalty/settings'),
  updateSettings: (settingsData: any) =>
    apiRequest('/loyalty/settings', {
      method: 'PATCH',
      body: JSON.stringify(settingsData),
    }),
  getClientLoyalty: (clientId: string) => apiRequest('/loyalty/clients/' + clientId),
  getClientPoints: (clientId: string) => apiRequest('/loyalty/clients/' + clientId),
  awardReward: (clientId: string, rewardData: any) =>
    apiRequest('/loyalty/clients/' + clientId + '/reward', {
      method: 'POST',
      body: JSON.stringify(rewardData),
    }),
  getUpcomingRewards: (days: number = 30) => apiRequest('/loyalty/rewards/upcoming?days=' + days),
  adjustPoints: (clientId: string, adjustData: any) =>
    apiRequest('/loyalty/clients/' + clientId + '/adjust', {
      method: 'POST',
      body: JSON.stringify(adjustData),
    }),
  redeem: (invoiceId: string, redeemData: any) =>
    apiRequest('/loyalty/invoices/' + invoiceId + '/redeem', {
      method: 'POST',
      body: JSON.stringify(redeemData),
    }),
  getRebooking: (params: any = {}) => {
    return apiRequest('/loyalty/rebooking'  + toQueryString(params));
  },
};

// 12. Reports & Analytics Module
function buildReportQuery(params: any = 'today') {
  return toQueryString(params);
}

export const reportsApi = {
  getDashboard: (params: any = 'today') => apiRequest('/reports/dashboard' + buildReportQuery(params)),
  getRevenue: (params: any = 'today') => apiRequest('/reports/revenue' + buildReportQuery(params)),
  getAppointments: (params: any = 'today') =>
    apiRequest('/reports/appointments' + buildReportQuery(params)),
  getTopServices: (params: any = 'today') =>
    apiRequest('/reports/top-services' + buildReportQuery(params)),
  getServicePerformance: (params: any = '30d') =>
    apiRequest('/reports/service-performance' + buildReportQuery(params)),
  getTechnicians: (params: any = 'today') =>
    apiRequest('/reports/technicians' + buildReportQuery(params)),
  getMyPerformance: (params: any = 'today') =>
    apiRequest('/reports/technicians/me' + buildReportQuery(params)),
  getTechnicianMe: (params: any = 'today') =>
    apiRequest('/reports/technicians/me' + buildReportQuery(params)),
  getTechnician: (id: string, params: any = 'today') =>
    apiRequest('/reports/technicians/' + id + buildReportQuery(params)),
  getStockConsumption: (params: any = 'today') =>
    apiRequest('/reports/stock-consumption' + buildReportQuery(params)),
  getCustomers: (params: any = 'today') =>
    apiRequest('/reports/customers' + buildReportQuery(params)),
};

// 13. WhatsApp Module
export const whatsappApi = {
  getAutomations: () => apiRequest('/whatsapp/automations'),
  getAutomationByType: (type: string) => apiRequest('/whatsapp/automations/' + type),
  updateAutomation: (type: string, data: any) =>
    apiRequest('/whatsapp/automations/' + type, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getLogs: (params: any = {}) => apiRequest('/whatsapp/logs' + toQueryString(params)),
  purgeOldLogs: (days: number = 30) =>
    apiRequest('/whatsapp/logs/purge', {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),
  getRetentionSettings: () => apiRequest('/whatsapp/settings/retention', { silent: true }),
  updateRetentionSettings: (days: number) =>
    apiRequest('/whatsapp/settings/retention', {
      method: 'PATCH',
      body: JSON.stringify({ days }),
      silent: true,
    }),
  getBossPhone: () => apiRequest('/whatsapp/settings/boss-phone', { silent: true }),
  updateBossPhone: (bossPhone: string) =>
    apiRequest('/whatsapp/settings/boss-phone', {
      method: 'POST',
      body: JSON.stringify({ bossPhone }),
      silent: true,
    }),
  processReminders: (data: any = {}) =>
    apiRequest('/whatsapp/triggers/process-reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerDailyClose: (data: any = {}) =>
    apiRequest('/whatsapp/triggers/daily-close', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerRebooking: (data: any = {}) =>
    apiRequest('/whatsapp/triggers/rebooking-reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerCelebrations: (data: any = {}) =>
    apiRequest('/whatsapp/triggers/celebrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerPaymentConfirmation: (invoiceId: string) =>
    apiRequest('/whatsapp/triggers/payment-confirmation', {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    }),
  triggerAfterService: (appointmentId: string) =>
    apiRequest('/whatsapp/triggers/after-service', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    }),
  triggerClientWelcome: (clientId: string) =>
    apiRequest('/whatsapp/triggers/client-welcome', {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    }),
  sendMessage: (data: any) =>
    apiRequest('/whatsapp/triggers/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendInvoicePdf: (invoiceId: string, phone?: string) =>
    apiRequest('/whatsapp/triggers/send-invoice-pdf', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, phone }),
    }),
  getInvoiceReceiptStatus: (invoiceId: string) =>
    apiRequest('/whatsapp/invoices/' + invoiceId + '/receipt-status'),
  retryMessage: (logId: string) =>
    apiRequest('/whatsapp/logs/' + logId + '/retry', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getHolidays: () => apiRequest('/whatsapp/holidays'),
  updateHoliday: (id: string, data: any) =>
    apiRequest('/whatsapp/holidays/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  testSendHoliday: (id: string, data: { phone: string; clientName?: string }) =>
    apiRequest('/whatsapp/holidays/' + id + '/test-send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerTodayHolidays: () =>
    apiRequest('/whatsapp/holidays/trigger-today', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

// 14. Feedback Module
export const feedbackApi = {
  getByToken: (token: string) => apiRequest('/public/feedback/' + token),
  submit: (token: string, data: any) =>
    apiRequest('/public/feedback/' + token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateToken: (data: any) =>
    apiRequest('/feedback/generate-token', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAll: (params: any = {}) => {
    return apiRequest('/client-feedback'  + toQueryString(params));
  },
};

// 15. Expenses Module
export const expensesApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/expenses'  + toQueryString(params));
  },
  create: (data: any) =>
    apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest('/expenses/' + id, {
      method: 'DELETE',
    }),
};

// 16. Uploads Module
export const uploadsApi = {
  uploadImage: (image: any, filename?: string) => {
    if (typeof FormData !== 'undefined' && image instanceof FormData) {
      return apiRequest('/media/upload/client', {
        method: 'POST',
        body: image,
      });
    }
    return apiRequest('/uploads', {
      method: 'POST',
      body: JSON.stringify({ image, filename }),
    });
  },
};

// 17. Media & Cleaning Module
export const mediaApi = {
  uploadClientMedia: (formData: FormData) =>
    apiRequest('/media/upload/client', {
      method: 'POST',
      body: formData,
    }),
  uploadAttendancePhoto: (formData: FormData) =>
    apiRequest('/media/upload/attendance', {
      method: 'POST',
      body: formData,
    }),
  uploadCleaningPhoto: (formData: FormData) =>
    apiRequest('/media/upload/cleaning', {
      method: 'POST',
      body: formData,
    }),
  getCleaningRecords: (params: any = {}) => {
    return apiRequest('/media/cleaning'  + toQueryString(params));
  },
  deleteCleaningRecord: (id: string) =>
    apiRequest('/media/cleaning/' + id, {
      method: 'DELETE',
    }),
  getClientMedia: (clientId: string) => apiRequest('/media/client/' + clientId),
  deleteClientMedia: (id: string) =>
    apiRequest('/media/client/' + id, {
      method: 'DELETE',
    }),
};

// 18. Attendance Module
export const attendanceApi = {
  clockIn: (data: any) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return apiRequest('/attendance/clock-in', {
        method: 'POST',
        body: data,
      });
    }
    return apiRequest('/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  clockOut: (data: any = {}) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return apiRequest('/attendance/clock-out', {
        method: 'POST',
        body: data,
      });
    }
    return apiRequest('/attendance/clock-out', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getToday: (params: any = {}) => {
    return apiRequest('/attendance/today'  + toQueryString(params));
  },
  getAll: (params: any = {}) => {
    return apiRequest('/attendance'  + toQueryString(params));
  },
  manualEntry: (data: any) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return apiRequest('/attendance/manual', {
        method: 'POST',
        body: data,
      });
    }
    return apiRequest('/attendance/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// 19. Social Media Module
export const socialApi = {
  getAccounts: () => apiRequest('/social/accounts'),
  getPosts: () => apiRequest('/social/posts'),
  uploadMedia: (formData: FormData) =>
    apiRequest('/social/upload', {
      method: 'POST',
      body: formData,
    }),
  createPost: (data: any) =>
    apiRequest('/social/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  publishNow: (id: string) =>
    apiRequest('/social/posts/' + id + '/publish', {
      method: 'POST',
    }),
  deletePost: (id: string) =>
    apiRequest('/social/posts/' + id, {
      method: 'DELETE',
    }),
};

// 20. Penalties Module
export const penaltiesApi = {
  getRules: () => apiRequest('/penalties/rules'),
  createPenalty: (data: any) =>
    apiRequest('/penalties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPenalties: (params: any = {}) => {
    return apiRequest('/penalties'  + toQueryString(params));
  },
  deletePenalty: (id: string) =>
    apiRequest('/penalties/' + id, {
      method: 'DELETE',
    }),
};

// 21. Job Seekers Module
export const jobSeekersApi = {
  getAll: (params: any = {}) => {
    return apiRequest('/job-seekers'  + toQueryString(params));
  },
  getById: (id: string) => apiRequest('/job-seekers/' + id),
  create: (data: any) =>
    apiRequest('/job-seekers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    apiRequest('/job-seekers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest('/job-seekers/' + id, {
      method: 'DELETE',
    }),
};

// 22. Shared Work Module
export const sharedWorkApi = {
  recordCollaborativeWork: (data: any) =>
    apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAll: (params: any = {}) => apiRequest('/invoices' + toQueryString(params)),
};


