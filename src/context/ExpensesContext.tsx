/**
 * ExpensesContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/expenses)
 * 1-to-1 Parity with frontend/src/context/ExpensesContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { expensesApi } from '../services/api';
import { useAuth } from './AuthContext';

export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Water',
  'Generator Fuel / Gas',
  'Maintenance',
  'Repairs',
  'Rent',
  'Cleaning Supplies',
  'Other',
];

export const EXPENSE_PAYMENT_METHODS = ['CASH', 'MTN MOMO', 'ORANGE MONEY'];

export interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  paymentMethod: string;
  note: string;
  date: string;
  createdBy?: string;
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ExpensesContextType {
  expenses: ExpenseItem[];
  loading: boolean;
  totalExpenses: number;
  todayExpensesTotal: number;
  refreshExpenses: () => Promise<void>;
  createExpense: (data: any) => Promise<{ success: boolean; error?: string }>;
  addExpense: (data: any) => Promise<{ success: boolean; error?: string }>;
  updateExpense: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
  deleteExpense: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const ExpensesContext = createContext<ExpensesContextType>({} as ExpensesContextType);

export const ExpensesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const hasAccess = role === 'manager' || role === 'reception';

  const refreshExpenses = useCallback(async () => {
    if (!isAuthenticated || !token || !hasAccess) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await expensesApi.getAll({ limit: 500 });
      const raw = res?.data;
      const list = Array.isArray(raw?.expenses)
        ? raw.expenses
        : Array.isArray(raw)
        ? raw
        : Array.isArray(res)
        ? res
        : [];

      const mapped: ExpenseItem[] = list.map((exp: any) => ({
        id: String(exp.id),
        category: exp.category || 'Other',
        amount: Number(exp.amount || 0),
        paymentMethod: exp.paymentMethod || 'CASH',
        note: exp.note || '',
        date: exp.date ? String(exp.date).split('T')[0] : new Date().toISOString().split('T')[0],
        createdBy:
          exp.createdBy ||
          exp.createdByUser?.name ||
          exp.createdByUser?.staffProfile?.name ||
          user?.name ||
          'Chebou Kemle',
        createdByUserId: exp.createdByUserId,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
      }));

      setExpenses(mapped);
    } catch (e) {
      console.warn('Failed to fetch expenses', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess, user?.name]);

  useEffect(() => {
    if (isAuthenticated && token && hasAccess) {
      refreshExpenses();
    } else {
      setExpenses([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess, refreshExpenses]);

  const addExpense = async (data: any): Promise<{ success: boolean; error?: string }> => {
    try {
      await expensesApi.create({
        date: data.date || new Date().toISOString().split('T')[0],
        category: data.category || 'Other',
        amount: Number(data.amount || 0),
        paymentMethod: data.paymentMethod || 'CASH',
        note: (data.note || '').trim(),
      });
      await refreshExpenses();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to record expense' };
    }
  };

  const createExpense = addExpense;

  const updateExpense = async (id: string, data: any): Promise<{ success: boolean; error?: string }> => {
    try {
      // Backend handles DELETE then POST if direct PATCH is not available
      await expensesApi.delete(id);
      await expensesApi.create({
        date: data.date || new Date().toISOString().split('T')[0],
        category: data.category || 'Other',
        amount: Number(data.amount || 0),
        paymentMethod: data.paymentMethod || 'CASH',
        note: (data.note || '').trim(),
      });
      await refreshExpenses();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update expense' };
    }
  };

  const deleteExpense = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await expensesApi.delete(id);
      await refreshExpenses();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete expense' };
    }
  };

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayExpensesTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses, todayStr]);

  return (
    <ExpensesContext.Provider
      value={{
        expenses,
        loading,
        totalExpenses,
        todayExpensesTotal,
        refreshExpenses,
        createExpense,
        addExpense,
        updateExpense,
        deleteExpense,
      }}
    >
      {children}
    </ExpensesContext.Provider>
  );
};

export const useExpenses = () => useContext(ExpensesContext);
export default ExpensesContext;
