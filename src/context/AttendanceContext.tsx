/**
 * AttendanceContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/attendance)
 * Includes Break Tracking with mandatory live camera verification
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { attendanceApi } from '../services/api';
import { useAuth } from './AuthContext';
import { createFormDataFile, dataUrlToFile } from '../utils/fileUpload';

export interface BreakRecord {
  id: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  startPhoto?: string;
  endPhoto?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockInTime?: string;
  clockInPhoto?: string;
  clockOutTime?: string;
  clockOutPhoto?: string;
  status: 'NOT_WORKING' | 'WORKING' | 'ON_BREAK' | 'CLOCKED_OUT';
  workingHours?: number;
  totalBreakMinutes: number;
  breaks: BreakRecord[];
  isManualEntry?: boolean;
  addedByManager?: string;
  reason?: string;
}

interface AttendanceContextType {
  todayRecord: AttendanceRecord | null;
  allRecords: AttendanceRecord[];
  loading: boolean;
  refreshAttendance: () => Promise<void>;
  clockIn: (photoUri: string) => Promise<void>;
  startBreak: (photoUri: string) => Promise<void>;
  endBreak: (photoUri: string) => Promise<void>;
  clockOut: (photoUri: string) => Promise<void>;
  manualEntry: (data: any) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType>({} as AttendanceContextType);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshAttendance = useCallback(async () => {
    if (!isAuthenticated || !token || !user) {
      setTodayRecord(null);
      setAllRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch today's record passing employeeId so backend targets current user directly
      const todayRes = await attendanceApi.getToday({ employeeId: user.id }).catch(() => null);
      const rawData = todayRes?.data || todayRes;

      const isMatchUser = (r: any) => {
        if (!r) return false;
        const matchId = String(r.employeeId) === String(user.id) || String(r.employee?.id) === String(user.id);
        const matchEmail = Boolean(user.email && (r.employee?.email === user.email || r.email === user.email));
        const matchName = Boolean(user.name && (r.employeeName === user.name || r.employee?.staffProfile?.name === user.name));
        return matchId || matchEmail || matchName;
      };

      let myRecord: any = null;
      if (rawData?.record) {
        myRecord = rawData.record;
      } else if (Array.isArray(rawData?.records)) {
        myRecord = rawData.records.find(isMatchUser) || (rawData.records.length === 1 ? rawData.records[0] : null);
      } else if (Array.isArray(rawData)) {
        myRecord = rawData.find(isMatchUser) || (rawData.length === 1 ? rawData[0] : null);
      } else if (rawData && (rawData.id || rawData.clockInTime)) {
        myRecord = rawData;
      }

      // 2. Fetch attendance history
      const allRes = await attendanceApi.getAll().catch(() => null);
      const rawHistory = allRes?.data || allRes;
      const list = Array.isArray(rawHistory?.records)
        ? rawHistory.records
        : Array.isArray(rawHistory)
        ? rawHistory
        : Array.isArray(rawHistory?.data)
        ? rawHistory.data
        : [];

      // 3. Fallback: If today's record wasn't found from getToday, find it in history list
      if (!myRecord && Array.isArray(list) && list.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        myRecord = list.find((r: any) => {
          const matchEmp = isMatchUser(r);
          const rDate = (r.date || '').slice(0, 10);
          const rInDate = (r.clockInTime || '').slice(0, 10);
          return matchEmp && (rDate === todayStr || rInDate === todayStr);
        }) || null;
      }

      if (myRecord && (myRecord.id || myRecord.clockInTime)) {
        const hasActiveBreak = Array.isArray(myRecord.breaks) && myRecord.breaks.length > 0 && !myRecord.breaks[myRecord.breaks.length - 1].endTime;
        const computedStatus = myRecord.status || (myRecord.clockOutTime ? 'CLOCKED_OUT' : hasActiveBreak ? 'ON_BREAK' : myRecord.clockInTime ? 'WORKING' : 'NOT_WORKING');

        setTodayRecord({
          id: String(myRecord.id || 'att-today'),
          employeeId: String(myRecord.employeeId || user.id),
          employeeName: myRecord.employee?.staffProfile?.name || myRecord.employeeName || user.name,
          date: (myRecord.date ? String(myRecord.date).slice(0, 10) : '') || new Date().toISOString().split('T')[0],
          clockInTime: myRecord.clockInTime,
          clockInPhoto: myRecord.clockInPhoto,
          clockOutTime: myRecord.clockOutTime,
          clockOutPhoto: myRecord.clockOutPhoto,
          status: computedStatus,
          workingHours: Number(myRecord.workingHours || 0),
          totalBreakMinutes: Number(myRecord.totalBreakMinutes || 0),
          breaks: Array.isArray(myRecord.breaks) ? myRecord.breaks : [],
          isManualEntry: Boolean(myRecord.isManualEntry),
          addedByManager: myRecord.addedByManager || myRecord.managerName,
          reason: myRecord.reason,
        });
      } else {
        setTodayRecord(null);
      }

      setAllRecords(
        list.map((r: any) => ({
          id: String(r.id),
          employeeId: String(r.employeeId),
          employeeName: r.employee?.staffProfile?.name || r.employeeName || user.name || 'Employee',
          date: (r.date ? String(r.date).slice(0, 10) : '') || '',
          clockInTime: r.clockInTime,
          clockInPhoto: r.clockInPhoto,
          clockOutTime: r.clockOutTime,
          clockOutPhoto: r.clockOutPhoto,
          status: r.status || (r.clockOutTime ? 'CLOCKED_OUT' : r.clockInTime ? 'WORKING' : 'NOT_WORKING'),
          workingHours: Number(r.workingHours || 0),
          totalBreakMinutes: Number(r.totalBreakMinutes || 0),
          breaks: Array.isArray(r.breaks) ? r.breaks : [],
          isManualEntry: Boolean(r.isManualEntry),
          addedByManager: r.addedByManager || r.managerName,
          reason: r.reason,
        }))
      );
    } catch (e) {
      console.warn('Failed to fetch attendance', e);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshAttendance();
    } else {
      setTodayRecord(null);
      setAllRecords([]);
    }
  }, [isAuthenticated, token, refreshAttendance]);

  const clockIn = async (photoUri: string) => {
    const today = new Date().toISOString().split('T')[0];
    const employeeId = user?.id;

    const formData = new FormData();
    if (employeeId) {
      formData.append('employeeId', employeeId);
    }
    formData.append('date', today);

    let fileObj: any = null;
    if (Platform.OS === 'web' && typeof photoUri === 'string' && photoUri.startsWith('data:')) {
      fileObj = dataUrlToFile(photoUri, 'clockin_' + Date.now() + '.jpg', 'image/jpeg');
    }
    if (!fileObj) {
      fileObj = await createFormDataFile(photoUri, 'clockin_' + Date.now() + '.jpg', 'image/jpeg');
    }

    if (fileObj) {
      // Multer single file middleware expects field 'image'
      formData.append('image', fileObj);
    }

    // Backend controller checks req.body.photo || req.body.image || req.body.photoBase64
    if (typeof photoUri === 'string') {
      formData.append('photo', photoUri);
      formData.append('photoBase64', photoUri);
    }

    let clockInRes: any = null;
    try {
      clockInRes = await attendanceApi.clockIn(formData);
    } catch (err: any) {
      console.warn('[Attendance] FormData clockIn failed, retrying with direct JSON payload:', err);
      if (typeof photoUri === 'string') {
        clockInRes = await attendanceApi.clockIn({
          employeeId,
          date: today,
          photo: photoUri,
          image: photoUri,
          photoBase64: photoUri,
        });
      } else {
        throw err;
      }
    }

    const createdRecord = clockInRes?.data || clockInRes;
    if (createdRecord && (createdRecord.id || createdRecord.clockInTime || createdRecord.status)) {
      setTodayRecord({
        id: String(createdRecord.id || 'att-today'),
        employeeId: String(createdRecord.employeeId || user?.id),
        employeeName: createdRecord.employee?.staffProfile?.name || createdRecord.employeeName || user?.name || 'Employee',
        date: (createdRecord.date ? String(createdRecord.date).slice(0, 10) : '') || today,
        clockInTime: createdRecord.clockInTime || new Date().toISOString(),
        clockInPhoto: createdRecord.clockInPhoto || (typeof photoUri === 'string' ? photoUri : undefined),
        clockOutTime: createdRecord.clockOutTime,
        clockOutPhoto: createdRecord.clockOutPhoto,
        status: 'WORKING',
        workingHours: Number(createdRecord.workingHours || 0),
        totalBreakMinutes: Number(createdRecord.totalBreakMinutes || 0),
        breaks: Array.isArray(createdRecord.breaks) ? createdRecord.breaks : [],
        isManualEntry: Boolean(createdRecord.isManualEntry),
        addedByManager: createdRecord.addedByManager || createdRecord.managerName,
        reason: createdRecord.reason,
      });
    }

    await refreshAttendance();
  };

  const startBreak = async (photoUri: string) => {
    if (!todayRecord) return;
    const newBreak: BreakRecord = {
      id: 'brk-' + Date.now(),
      startTime: new Date().toISOString(),
      durationMinutes: 0,
      startPhoto: photoUri,
    };
    setTodayRecord({
      ...todayRecord,
      status: 'ON_BREAK',
      breaks: [...(todayRecord.breaks || []), newBreak],
    });
  };

  const endBreak = async (photoUri: string) => {
    if (!todayRecord || !todayRecord.breaks.length) return;
    const breaks = [...todayRecord.breaks];
    const lastBreak = { ...breaks[breaks.length - 1] };
    const now = new Date();
    const start = new Date(lastBreak.startTime);
    const duration = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));

    lastBreak.endTime = now.toISOString();
    lastBreak.endPhoto = photoUri;
    lastBreak.durationMinutes = duration;
    breaks[breaks.length - 1] = lastBreak;

    const totalBreaks = breaks.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    setTodayRecord({
      ...todayRecord,
      status: 'WORKING',
      breaks,
      totalBreakMinutes: totalBreaks,
    });
  };

  const clockOut = async (photoUri: string) => {
    const today = new Date().toISOString().split('T')[0];
    const employeeId = user?.id;

    const formData = new FormData();
    if (employeeId) {
      formData.append('employeeId', employeeId);
    }
    formData.append('date', today);

    let fileObj: any = null;
    if (Platform.OS === 'web' && typeof photoUri === 'string' && photoUri.startsWith('data:')) {
      fileObj = dataUrlToFile(photoUri, 'clockout_' + Date.now() + '.jpg', 'image/jpeg');
    }
    if (!fileObj) {
      fileObj = await createFormDataFile(photoUri, 'clockout_' + Date.now() + '.jpg', 'image/jpeg');
    }

    if (fileObj) {
      // Multer single file middleware expects field 'image'
      formData.append('image', fileObj);
    }

    if (typeof photoUri === 'string') {
      formData.append('photo', photoUri);
      formData.append('photoBase64', photoUri);
    }

    let clockOutRes: any = null;
    try {
      clockOutRes = await attendanceApi.clockOut(formData);
    } catch (err: any) {
      console.warn('[Attendance] FormData clockOut failed, retrying with direct JSON payload:', err);
      if (typeof photoUri === 'string') {
        clockOutRes = await attendanceApi.clockOut({
          employeeId,
          date: today,
          photo: photoUri,
          image: photoUri,
          photoBase64: photoUri,
        });
      } else {
        throw err;
      }
    }

    const updatedRecord = clockOutRes?.data || clockOutRes;
    if (updatedRecord && (updatedRecord.id || updatedRecord.clockOutTime || updatedRecord.status)) {
      setTodayRecord((prev) => ({
        ...(prev || {}),
        id: String(updatedRecord.id || prev?.id || 'att-today'),
        employeeId: String(updatedRecord.employeeId || prev?.employeeId || user?.id),
        employeeName: updatedRecord.employee?.staffProfile?.name || updatedRecord.employeeName || prev?.employeeName || user?.name || 'Employee',
        date: (updatedRecord.date ? String(updatedRecord.date).slice(0, 10) : '') || prev?.date || today,
        clockInTime: updatedRecord.clockInTime || prev?.clockInTime,
        clockInPhoto: updatedRecord.clockInPhoto || prev?.clockInPhoto,
        clockOutTime: updatedRecord.clockOutTime || new Date().toISOString(),
        clockOutPhoto: updatedRecord.clockOutPhoto || photoUri,
        status: 'CLOCKED_OUT',
        workingHours: Number(updatedRecord.workingHours || prev?.workingHours || 0),
        totalBreakMinutes: Number(updatedRecord.totalBreakMinutes || prev?.totalBreakMinutes || 0),
        breaks: Array.isArray(updatedRecord.breaks) ? updatedRecord.breaks : prev?.breaks || [],
        isManualEntry: Boolean(updatedRecord.isManualEntry ?? prev?.isManualEntry),
        addedByManager: updatedRecord.addedByManager || updatedRecord.managerName || prev?.addedByManager,
        reason: updatedRecord.reason || prev?.reason,
      }));
    }

    await refreshAttendance();
  };

  const manualEntry = async (data: any) => {
    await attendanceApi.manualEntry(data);
    await refreshAttendance();
  };

  return (
    <AttendanceContext.Provider
      value={{
        todayRecord,
        allRecords,
        loading,
        refreshAttendance,
        clockIn,
        startBreak,
        endBreak,
        clockOut,
        manualEntry,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => useContext(AttendanceContext);
export default AttendanceContext;
