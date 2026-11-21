/**
 * CommissionContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/commissions & /api/v1/penalties)
 * Implements:
 * 1. Referral & Service Commission Ledger & Rules (1-to-1 match with Web POS)
 * 2. Employee Commission Summaries (Clients Referred & Services Completed)
 * 3. Target-Based Dynamic Hybrid Salary Formula
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { commissionsApi, penaltiesApi } from '../services/api';
import { useAuth } from './AuthContext';
import { useClients } from './ClientsContext';

export interface PenaltyRecord {
  id: string;
  staffId: string;
  staffName: string;
  ruleName: string;
  penaltyAmount: number;
  date: string;
  notes?: string;
}

export interface SalaryContract {
  monthlyTarget: number;
  fixedSalary: number;
  basePay: number;
  commissionRate: number;
}

export interface TechnicianSummary {
  technicianId: string;
  technicianName: string;
  personalMtdRevenue: number;
  monthlyTarget: number;
  targetMet: boolean;
  fixedSalary: number;
  basePay: number;
  commissionRate: number;
  netCommission: number;
  totalPenalties: number;
  projectedPayout: number;
  operationalMode: 'MODE_A_FIXED' | 'MODE_B_COMMISSION';
}

export interface CommissionItem {
  id: string;
  date: string;
  client: string;
  clientId: string | null;
  service: string;
  serviceCategory: string;
  serviceAmount: number;
  referralEmployee: string;
  referralEmployeeId: string;
  performingTechnician: string;
  performingTechnicianId: string;
  commissionPercentage: number;
  baseCommission: number;
  bonusAmount: number;
  commissionAmount: number;
  totalCommission: number;
  status: string;
  rawStatus: string;
  invoiceId: string;
  invoiceNumber?: string;
  notes?: string;
  activities?: any[];
  createdAt: string;
}

export interface EmployeeCommissionSummary {
  id: string;
  name: string;
  role: string;
  clientsReferred: number;
  completedServices: number;
  commissionEarned: number;
}

interface CommissionContextType {
  commissions: CommissionItem[];
  commissionRules: any[];
  commissionRate: number;
  commissionFixedAmount: number | null;
  commissionRuleMode: 'percentage' | 'fixed';
  summary: {
    totalBaseCommission: number;
    totalBonusAmount: number;
    totalEarned: number;
    totalApproved: number;
    totalPending: number;
  };
  technicianSummary: TechnicianSummary | null;
  penalties: PenaltyRecord[];
  loading: boolean;
  refreshCommissions: () => Promise<void>;
  setCommissionRule: (params: {
    mode?: 'percentage' | 'fixed';
    percentage?: number;
    fixedAmount?: number | null;
  }) => Promise<{ success: boolean; error?: string }>;
  approveCommission: (id: string) => Promise<{ success: boolean; error?: string }>;
  getEmployeeCommissionSummary: (nameOrId: string) => {
    clientsReferred: number;
    completedServices: number;
    commissionEarned: number;
  };
  getAllEmployeeSummaries: () => EmployeeCommissionSummary[];
  recordPenalty: (data: any) => Promise<void>;
  updateSalaryContract: (staffId: string, contract: SalaryContract) => Promise<void>;
}

const CommissionContext = createContext<CommissionContextType>({} as CommissionContextType);

function formatCommission(c: any): CommissionItem {
  const techName =
    c.technician?.staffProfile?.name ||
    (c.technician?.email ? c.technician.email.split('@')[0] : 'Staff');

  const d = new Date(c.createdAt || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const baseCommission = Number(c.baseCommission) || 0;
  const bonusAmount = Number(c.bonusAmount) || 0;
  const totalCommission = Number(c.totalCommission) || baseCommission + bonusAmount;

  return {
    id: String(c.id),
    date: formattedDate,
    client: c.invoice?.clientName || 'Client',
    clientId: null,
    service: c.serviceName || 'Service',
    serviceCategory: c.serviceCategory || 'General',
    serviceAmount: Number(c.servicePrice) || 0,
    referralEmployee: techName,
    referralEmployeeId: String(c.technicianId || ''),
    performingTechnician: techName,
    performingTechnicianId: String(c.technicianId || ''),
    commissionPercentage: Number(c.commissionRate) || 10,
    baseCommission,
    bonusAmount,
    commissionAmount: totalCommission,
    totalCommission,
    status: c.status === 'APPROVED' ? 'Approved' : c.status === 'PAID' ? 'Paid' : 'Pending',
    rawStatus: c.status || 'PENDING',
    invoiceId: String(c.invoiceId || ''),
    invoiceNumber: c.invoice?.invoiceNumber,
    notes: c.notes,
    activities: c.activities || [],
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

export const CommissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, allUsers, isAuthenticated, token } = useAuth();
  const { clients } = useClients();

  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [commissionRules, setCommissionRules] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [commissionFixedAmount, setCommissionFixedAmount] = useState<number | null>(null);
  const [commissionRuleMode, setCommissionRuleMode] = useState<'percentage' | 'fixed'>('percentage');
  const [summary, setSummary] = useState({
    totalBaseCommission: 0,
    totalBonusAmount: 0,
    totalEarned: 0,
    totalApproved: 0,
    totalPending: 0,
  });

  const [technicianSummary, setTechnicianSummary] = useState<TechnicianSummary | null>(null);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const canAccessCommissions = role === 'technician' || role === 'marketer' || role === 'manager' || role === 'reception';

  const refreshCommissions = useCallback(async () => {
    if (!isAuthenticated || !token || !user || user.role === 'cleaner') {
      setCommissions([]);
      setTechnicianSummary(null);
      setPenalties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch commissions list & penalties in parallel
      const [commRes, penaltiesRes] = await Promise.all([
        canAccessCommissions ? commissionsApi.getAll({ limit: 100 }).catch(() => null) : Promise.resolve(null),
        penaltiesApi.getPenalties().catch(() => null),
      ]);

      if (commRes) {
        const rawCommissions = commRes?.data?.commissions || (Array.isArray(commRes?.data) ? commRes.data : Array.isArray(commRes) ? commRes : []);
        const mapped = rawCommissions.map(formatCommission);
        setCommissions(mapped);

        if (commRes?.data?.summary) {
          setSummary(commRes.data.summary);
        } else {
          const totalEarned = mapped.reduce((sum: number, c: CommissionItem) => sum + (c.commissionAmount || 0), 0);
          setSummary({
            totalBaseCommission: totalEarned,
            totalBonusAmount: 0,
            totalEarned,
            totalApproved: totalEarned,
            totalPending: 0,
          });
        }
      }

      // 2. Fetch commission rules for Manager & Reception
      if (role === 'manager' || role === 'reception') {
        const rulesRes = await commissionsApi.getRules().catch(() => null);
        const rules = rulesRes?.data || [];
        setCommissionRules(rules);
        const generalRule = rules.find(
          (r: any) =>
            r.serviceCategory?.toLowerCase() === 'general' ||
            r.serviceCategory?.toLowerCase() === 'referral' ||
            r.type === 'REFERRAL'
        );
        const targetRule = generalRule || (rules.length > 0 ? rules[0] : null);
        if (targetRule) {
          const fixed = targetRule.fixedAmount != null ? Number(targetRule.fixedAmount) : null;
          const pct = targetRule.percentage != null ? Number(targetRule.percentage) : 10;
          if (fixed != null && fixed > 0 && (pct === 0 || targetRule.type === 'REFERRAL')) {
            setCommissionFixedAmount(fixed);
            setCommissionRate(pct);
            setCommissionRuleMode('fixed');
          } else {
            setCommissionRate(pct > 0 ? pct : 10);
            setCommissionFixedAmount(fixed);
            setCommissionRuleMode(fixed != null && fixed > 0 && pct === 0 ? 'fixed' : 'percentage');
          }
        }
      }

      // 3. Penalties mapping
      let staffPenaltiesList: PenaltyRecord[] = [];
      if (penaltiesRes) {
        const list = Array.isArray(penaltiesRes?.data) ? penaltiesRes.data : Array.isArray(penaltiesRes) ? penaltiesRes : [];
        staffPenaltiesList = list.map((p: any) => ({
          id: String(p.id),
          staffId: String(p.staffId),
          staffName: p.staff?.staffProfile?.name || p.staff?.email || 'Staff',
          ruleName: p.ruleName,
          penaltyAmount: Number(p.penaltyAmount || 0),
          date: p.date ? p.date.split('T')[0] : '',
          notes: p.notes,
        }));
        setPenalties(staffPenaltiesList);
      }

      // 4. Technician personal summary if technician
      if (role === 'technician') {
        const summaryRes = await commissionsApi.getTechnicianSummary(user.id).catch(() => null);
        if (summaryRes) {
          const raw = summaryRes?.data || summaryRes || {};
          const rev = Number(raw.personalRevenue || raw.mtdRevenue || 0);
          const target = Number(raw.monthlyTarget || 200000);
          const fixed = Number(raw.fixedSalary || 80000);
          const base = Number(raw.basePay || 50000);
          const rate = Number(raw.commissionRate || 0.15);
          const deductions = Number(raw.referralDeductions || 0);

          const targetMet = rev >= target;
          const totalStaffPenalties = staffPenaltiesList
            .filter((p) => String(p.staffId) === String(user.id))
            .reduce((sum, curr) => sum + curr.penaltyAmount, 0);

          let projected = fixed;
          let mode: 'MODE_A_FIXED' | 'MODE_B_COMMISSION' = 'MODE_A_FIXED';

          if (targetMet) {
            mode = 'MODE_B_COMMISSION';
            const calculatedComm = Math.max(0, rev * rate - deductions);
            projected = Math.max(fixed, base + calculatedComm);
          }

          setTechnicianSummary({
            technicianId: user.id,
            technicianName: user.name,
            personalMtdRevenue: rev,
            monthlyTarget: target,
            targetMet,
            fixedSalary: fixed,
            basePay: base,
            commissionRate: rate,
            netCommission: targetMet ? Math.max(0, rev * rate - deductions) : 0,
            totalPenalties: totalStaffPenalties,
            projectedPayout: projected,
            operationalMode: mode,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load commissions', e);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, token, canAccessCommissions, role]);

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshCommissions();
    } else {
      setCommissions([]);
      setTechnicianSummary(null);
      setPenalties([]);
    }
  }, [isAuthenticated, token, refreshCommissions]);

  // Set Commission Rule (Manager can configure Percentage or Fixed Amount)
  const setCommissionRule = useCallback(
    async ({
      mode = 'percentage',
      percentage = 10,
      fixedAmount = null,
    }: {
      mode?: 'percentage' | 'fixed';
      percentage?: number;
      fixedAmount?: number | null;
    }) => {
      const isFixed = mode === 'fixed';
      const pct = !isFixed ? Math.max(0, Math.min(100, Number(percentage) || 10)) : 0;
      const fixed = isFixed ? Math.max(1, Math.round(Number(fixedAmount) || 1000)) : null;

      setCommissionRuleMode(isFixed ? 'fixed' : 'percentage');
      if (isFixed) {
        setCommissionFixedAmount(fixed);
        setCommissionRate(0);
      } else {
        setCommissionRate(pct);
        setCommissionFixedAmount(null);
      }

      if (user?.role === 'manager') {
        try {
          await commissionsApi.saveRule({
            serviceCategory: 'General',
            percentage: pct,
            fixedAmount: fixed,
            type: 'REFERRAL',
          });
          await refreshCommissions();
          return { success: true };
        } catch (err: any) {
          console.error('Failed to save referral commission rule:', err);
          return { success: false, error: err?.message || 'Failed to save rule' };
        }
      }
      return { success: true };
    },
    [user, refreshCommissions]
  );

  // Approve Commission Payout (Manager only)
  const approveCommission = useCallback(
    async (commissionId: string) => {
      if (user?.role !== 'manager') return { success: false, error: 'Unauthorized' };
      try {
        await commissionsApi.approve(commissionId);
        await refreshCommissions();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to approve commission' };
      }
    },
    [user, refreshCommissions]
  );

  // Summary for a single employee (from real backend commissions & clients)
  const getEmployeeCommissionSummary = useCallback(
    (employeeNameOrId: string) => {
      if (!employeeNameOrId) {
        return { clientsReferred: 0, completedServices: 0, commissionEarned: 0 };
      }

      const matchStr = String(employeeNameOrId).toLowerCase().trim();

      // Count clients referred
      const myClients = (clients || []).filter(
        (c: any) =>
          (c.introducedBy && c.introducedBy.toLowerCase().trim() === matchStr) ||
          (c.introducedByName && c.introducedByName.toLowerCase().trim() === matchStr) ||
          (c.introducedById && String(c.introducedById) === matchStr)
      );

      // Count completed commission records & total earned from real backend items
      const myCommissions = (commissions || []).filter(
        (comm: any) =>
          (comm.referralEmployee && comm.referralEmployee.toLowerCase().trim() === matchStr) ||
          (comm.referralEmployeeId && String(comm.referralEmployeeId) === matchStr) ||
          (comm.performingTechnician && comm.performingTechnician.toLowerCase().trim() === matchStr) ||
          (comm.performingTechnicianId && String(comm.performingTechnicianId) === matchStr)
      );

      const totalEarned = myCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

      return {
        clientsReferred: myClients.length,
        completedServices: myCommissions.length,
        commissionEarned: totalEarned,
      };
    },
    [clients, commissions]
  );

  // Performance breakdown for all technicians (Manager Report matching web POS)
  const getAllEmployeeSummaries = useCallback((): EmployeeCommissionSummary[] => {
    const technicians = (allUsers || []).filter(
      (u: any) => u.role === 'technician' && u.active !== false
    );

    return technicians.map((tech: any) => {
      const staffSummary = getEmployeeCommissionSummary(tech.name);
      const roleStr = Array.isArray(tech.specialties) && tech.specialties.length > 0
        ? tech.specialties[0]
        : (typeof tech.specialties === 'string' && tech.specialties ? tech.specialties : 'Technician');

      return {
        id: String(tech.id),
        name: tech.name,
        role: roleStr,
        ...staffSummary,
      };
    });
  }, [allUsers, getEmployeeCommissionSummary]);

  const recordPenalty = async (data: any) => {
    await penaltiesApi.createPenalty(data);
    await refreshCommissions();
  };

  const updateSalaryContract = async (staffId: string, contract: SalaryContract) => {
    await commissionsApi.adjust(staffId, contract);
    await refreshCommissions();
  };

  return (
    <CommissionContext.Provider
      value={{
        commissions,
        commissionRules,
        commissionRate,
        commissionFixedAmount,
        commissionRuleMode,
        summary,
        technicianSummary,
        penalties,
        loading,
        refreshCommissions,
        setCommissionRule,
        approveCommission,
        getEmployeeCommissionSummary,
        getAllEmployeeSummaries,
        recordPenalty,
        updateSalaryContract,
      }}
    >
      {children}
    </CommissionContext.Provider>
  );
};

export const useCommissions = () => useContext(CommissionContext);
export default CommissionContext;
