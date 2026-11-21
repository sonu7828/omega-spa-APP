/**
 * CleaningContext for OMEGA SPA Mobile
 * Connects directly to OMEGA SPA POS Backend (/api/v1/media/cleaning)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mediaApi } from '../services/api';
import { useAuth } from './AuthContext';
import { createFormDataFile } from '../utils/fileUpload';

export interface CleaningRecord {
  id: string;
  area: string;
  cleanerName: string;
  beforePhoto?: string;
  afterPhoto?: string;
  photo?: string;
  photos?: string[];
  photoCount?: number;
  notes?: string;
  note?: string;
  date?: string;
  time?: string;
  createdAt: string;
}

interface CleaningContextType {
  records: CleaningRecord[];
  loading: boolean;
  refreshCleaningRecords: () => Promise<void>;
  uploadCleaningTask: (data: {
    area?: string;
    beforePhotoUri?: string;
    afterPhotoUri?: string;
    photoUris?: string[];
    notes?: string;
  }) => Promise<void>;
  deleteCleaningRecord: (id: string) => Promise<void>;
}

const CleaningContext = createContext<CleaningContextType>({} as CleaningContextType);

export const CleaningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [records, setRecords] = useState<CleaningRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const role = (user?.role || '').toLowerCase();
  const canAccessCleaning = role === 'cleaner' || role === 'manager' || role === 'reception';

  const refreshCleaningRecords = useCallback(async () => {
    if (!isAuthenticated || !token || !canAccessCleaning) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await mediaApi.getCleaningRecords().catch(() => null);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const mapped = list.map((r: any) => {
        const rawPhotos = Array.isArray(r.photos)
          ? r.photos.map((p: any) => (typeof p === 'string' ? p : p.url))
          : [r.photo, r.afterPhotoUrl, r.beforePhotoUrl, r.afterPhoto, r.beforePhoto].filter(Boolean);
        const photos = Array.from(new Set(rawPhotos));
        const photo = photos[0] || r.photo || r.afterPhotoUrl || r.beforePhotoUrl;
        const count = r.photoCount || photos.length || (photo ? 1 : 0);

        let dateStr = r.date || '';
        let timeStr = r.time || '';
        if ((!dateStr || !timeStr) && r.createdAt) {
          const d = new Date(r.createdAt);
          if (!isNaN(d.getTime())) {
            if (!dateStr) {
              dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            if (!timeStr) {
              timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
          }
        }

        return {
          id: String(r.id),
          area: r.area || 'General Cleaning',
          cleanerName: r.cleaner?.staffProfile?.name || r.cleaner?.email || r.cleanerName || 'cleaner',
          beforePhoto: r.beforePhotoUrl || r.beforePhoto,
          afterPhoto: r.afterPhotoUrl || r.afterPhoto,
          photo,
          photos,
          photoCount: count,
          notes: r.notes || r.note,
          note: r.note || r.notes || 'Cleaning Proof',
          date: dateStr || '4 Nov 2026',
          time: timeStr || '18:01',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        };
      });
      setRecords(mapped);
    } catch (e) {
      console.warn('Failed to fetch cleaning records', e);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, token, canAccessCleaning]);

  useEffect(() => {
    if (isAuthenticated && token && canAccessCleaning) {
      refreshCleaningRecords();
    } else {
      setRecords([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, canAccessCleaning, refreshCleaningRecords]);

  const uploadCleaningTask = async (data: {
    area?: string;
    beforePhotoUri?: string;
    afterPhotoUri?: string;
    photoUris?: string[];
    notes?: string;
  }) => {
    const formData = new FormData();
    formData.append('area', data.area || 'General Cleaning');
    if (data.notes) {
      formData.append('notes', data.notes);
      formData.append('note', data.notes);
    }

    const uris = (data.photoUris && data.photoUris.length > 0)
      ? data.photoUris
      : ([data.afterPhotoUri, data.beforePhotoUri].filter(Boolean) as string[]);

    for (let idx = 0; idx < uris.length; idx++) {
      const uri = uris[idx];
      const filename = `clean_${Date.now()}_${idx}.jpg`;
      const fileObj = await createFormDataFile(uri, filename, 'image/jpeg');

      if (fileObj) {
        formData.append('images', fileObj);
      }

      // If data URI (e.g. from camera web/base64), also send as base64 string fallback
      if (typeof uri === 'string' && (uri.startsWith('data:') || uri.length > 500)) {
        formData.append('base64Images', uri);
      }
    }

    await mediaApi.uploadCleaningPhoto(formData);
    await refreshCleaningRecords();
  };

  const deleteCleaningRecord = async (id: string) => {
    await mediaApi.deleteCleaningRecord(id);
    await refreshCleaningRecords();
  };

  return (
    <CleaningContext.Provider
      value={{
        records,
        loading,
        refreshCleaningRecords,
        uploadCleaningTask,
        deleteCleaningRecord,
      }}
    >
      {children}
    </CleaningContext.Provider>
  );
};

export const useCleaning = () => useContext(CleaningContext);
export default CleaningContext;
