/**
 * JobSeekersContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/job-seekers)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jobSeekersApi } from '../services/api';
import { useAuth } from './AuthContext';

export const JOB_SEEKER_POSITIONS = [
  'Massage Therapist',
  'Nail Technician',
  'Esthetician / Facial',
  'Receptionist',
  'Cleaner',
  'Marketer',
  'Hair Stylist',
  'Other',
];

export const JOB_SEEKER_STATUSES = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'NEW', label: 'Applied' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

export interface JobSeeker {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  positionApplied: string;
  experienceYears?: number;
  status: 'NEW' | 'INTERVIEW_SCHEDULED' | 'HIRED' | 'REJECTED' | string;
  notes?: string;
  createdAt: string;
}

interface JobSeekersContextType {
  jobSeekers: JobSeeker[];
  loading: boolean;
  refreshJobSeekers: () => Promise<void>;
  createJobSeeker: (data: any) => Promise<void>;
  updateJobSeekerStatus: (id: string, status: JobSeeker['status']) => Promise<void>;
  deleteJobSeeker: (id: string) => Promise<void>;
}

const JobSeekersContext = createContext<JobSeekersContextType>({} as JobSeekersContextType);

export const JobSeekersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [jobSeekers, setJobSeekers] = useState<JobSeeker[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const hasAccess = role === 'manager' || role === 'reception';

  const refreshJobSeekers = useCallback(async () => {
    if (!isAuthenticated || !token || !hasAccess) {
      setJobSeekers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await jobSeekersApi.getAll();
      const raw = res?.data;
      const list = Array.isArray(raw?.candidates)
        ? raw.candidates
        : Array.isArray(raw)
        ? raw
        : Array.isArray(res)
        ? res
        : [];

      const mapped = list.map((j: any) => ({
        id: String(j.id),
        fullName: j.fullName || j.name || 'Candidate',
        phone: j.phone || '',
        email: j.email,
        positionApplied: j.positionApplied || 'Therapist',
        experienceYears: Number(j.experienceYears || 0),
        status: (j.status || 'NEW').toUpperCase() as JobSeeker['status'],
        notes: j.notes,
        createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
      }));
      setJobSeekers(mapped);
    } catch (e) {
      console.warn('Failed to fetch job seekers', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess]);

  useEffect(() => {
    if (isAuthenticated && token && hasAccess) {
      refreshJobSeekers();
    } else {
      setJobSeekers([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, hasAccess, refreshJobSeekers]);

  const createJobSeeker = async (data: any) => {
    await jobSeekersApi.create(data);
    await refreshJobSeekers();
  };

  const updateJobSeekerStatus = async (id: string, status: JobSeeker['status']) => {
    await jobSeekersApi.update(id, { status });
    await refreshJobSeekers();
  };

  const deleteJobSeeker = async (id: string) => {
    await jobSeekersApi.delete(id);
    await refreshJobSeekers();
  };

  return (
    <JobSeekersContext.Provider
      value={{
        jobSeekers,
        loading,
        refreshJobSeekers,
        createJobSeeker,
        updateJobSeekerStatus,
        deleteJobSeeker,
      }}
    >
      {children}
    </JobSeekersContext.Provider>
  );
};

export const useJobSeekers = () => useContext(JobSeekersContext);
export default JobSeekersContext;

