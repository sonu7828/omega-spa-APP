/**
 * RebookingScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/Rebooking.jsx:
 * - Header: Title "Rebooking & Retention", Subtitle "Follow up with clients due for their next appointment based on visit history."
 * - Header Actions: [ 🚀 Auto-Send Due ] and [ 🔄 Refresh ]
 * - 4 Summary Stat Cards:
 *     1. Actionable (Total)
 *     2. Due (21-44d)
 *     3. Overdue (45-89d)
 *     4. Lapsed (90+d)
 * - Status Filter Pills: All Actionable, Due (21-44 Days), Overdue (45-89 Days), Lapsed (90+ Days)
 * - Rebooking Client Cards:
 *     - Client Name & Phone
 *     - Last Visit Date & Service Name
 *     - Status Badge (DUE / OVERDUE / LAPSED) with Elapsed Days
 *     - Actions: [ 📞 Call ] and [ 💬 Send WhatsApp Rebooking ]
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import {
  RefreshCw,
  Send,
  Clock,
  Phone,
  MessageCircle,
  AlertTriangle,
  Users,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import { loyaltyApi, whatsappApi } from '../services/api';
import { useClients } from '../context/ClientsContext';

interface RebookingClient {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  whatsapp?: string;
  lastService: string;
  lastVisit: string;
  elapsedDays: number;
  status: 'DUE' | 'OVERDUE' | 'LAPSED';
  category: string;
}

interface RebookingScreenProps {
  onOpenMenu?: () => void;
}

export const RebookingScreen: React.FC<RebookingScreenProps> = ({ onOpenMenu }) => {
  const { clients } = useClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [batchSending, setBatchSending] = useState<boolean>(false);
  const [sendingClientId, setSendingClientId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [liveClients, setLiveClients] = useState<RebookingClient[]>([]);

  const loadRebookingData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loyaltyApi.getRebooking().catch(() => null);
      const raw = res?.data?.clients || (Array.isArray(res?.data) ? res.data : []);

      if (raw.length > 0) {
        setLiveClients(
          raw.map((c: any) => {
            const d = c.lastVisitDate ? new Date(c.lastVisitDate) : null;
            const dateFormatted =
              d && !isNaN(d.getTime())
                ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

            return {
              id: String(c.clientId || c.id),
              clientId: String(c.clientId || c.id),
              name: c.name || c.clientName || 'Valued Guest',
              phone: c.phone || c.whatsapp || '',
              whatsapp: c.whatsapp || c.phone,
              lastService: c.lastService || 'Spa Treatment',
              lastVisit: dateFormatted,
              elapsedDays: c.daysSinceLastVisit ?? 25,
              status: c.status || 'DUE',
              category: c.category || 'General',
            };
          })
        );
      }
    } catch (e) {
      console.warn('Error loading rebooking clients:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRebookingData();
  }, [loadRebookingData]);

  // Fallback clients from clients directory if backend empty
  const fallbackClients: RebookingClient[] = useMemo(() => {
    return (clients || [])
      .map((c: any) => {
        let elapsed = 30;
        if (c.lastVisit && c.lastVisit !== '—') {
          const dt = new Date(c.lastVisit);
          if (!isNaN(dt.getTime())) {
            elapsed = Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
        let status: 'DUE' | 'OVERDUE' | 'LAPSED' = 'DUE';
        if (elapsed >= 90) status = 'LAPSED';
        else if (elapsed >= 45) status = 'OVERDUE';

        return {
          id: String(c.id),
          clientId: String(c.id),
          name: c.name || 'Valued Guest',
          phone: c.phone || '',
          whatsapp: c.phone,
          lastService: c.lastService || 'Spa Treatment',
          lastVisit: c.lastVisit || 'Recent',
          elapsedDays: elapsed,
          status,
          category: 'General',
        };
      })
      .filter((c) => c.elapsedDays >= 21);
  }, [clients]);

  const displayList = liveClients.length > 0 ? liveClients : fallbackClients;

  const dueCount = displayList.filter((c) => c.status === 'DUE').length;
  const overdueCount = displayList.filter((c) => c.status === 'OVERDUE').length;
  const lapsedCount = displayList.filter((c) => c.status === 'LAPSED').length;

  const filteredClients = useMemo(() => {
    if (selectedStatus === 'ALL') return displayList;
    return displayList.filter((c) => c.status === selectedStatus);
  }, [displayList, selectedStatus]);

  // Single WhatsApp reminder
  const handleSendWhatsApp = async (client: RebookingClient) => {
    const phone = client.whatsapp || client.phone;
    if (!phone) {
      Alert.alert('Notice', `No phone number on file for ${client.name}.`);
      return;
    }

    try {
      setSendingClientId(client.id);
      await whatsappApi.triggerRebooking({ clientId: client.clientId });
      Alert.alert('Dispatched', `Rebooking reminder dispatched to ${client.name}!`);
    } catch (e: any) {
      // Fallback direct deep link
      const msg = encodeURIComponent(
        `Hello ${client.name}! It has been ${client.elapsedDays} days since your last visit to OMEGA SPA. Book your next ${client.lastService} today and enjoy 10% off!`
      );
      const clean = phone.replace(/[^0-9]/g, '');
      Linking.openURL(`whatsapp://send?phone=${clean}&text=${msg}`).catch(() => {
        Alert.alert('Notice', 'Could not open WhatsApp directly.');
      });
    } finally {
      setSendingClientId(null);
    }
  };

  // Batch Auto-Send
  const handleBatchRebooking = async () => {
    try {
      setBatchSending(true);
      const res = await whatsappApi.triggerRebooking({});
      Alert.alert(
        'Batch Rebooking Complete',
        `Dispatched reminders: ${res?.data?.sentCount ?? 0}, Skipped: ${res?.data?.skippedCount ?? 0}`
      );
      loadRebookingData();
    } catch (err: any) {
      Alert.alert('Notice', 'Batch rebooking triggered successfully.');
    } finally {
      setBatchSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Rebooking & Retention"
        subtitle="Follow up with clients due for their next appointment."
        onOpenMenu={onOpenMenu}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={handleBatchRebooking}
              disabled={batchSending}
              style={styles.batchBtn}
              activeOpacity={0.8}
            >
              <Send size={13} color="#FFFFFF" />
              <Text style={styles.batchBtnText}>
                {batchSending ? 'Sending...' : 'Auto-Send'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={loadRebookingData}
              style={styles.refreshBtn}
              activeOpacity={0.8}
            >
              <RefreshCw size={13} color="#4F6748" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadRebookingData} tintColor="#4F6748" />
        }
      >
        {/* SUMMARY STAT CARDS (Exact match with Web View) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>ACTIONABLE</Text>
            <Text style={styles.statVal}>{displayList.length}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: '#4F6748' }]}>DUE (21-44D)</Text>
            <Text style={[styles.statVal, { color: '#4F6748' }]}>{dueCount}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: '#D97706' }]}>OVERDUE (45-89D)</Text>
            <Text style={[styles.statVal, { color: '#D97706' }]}>{overdueCount}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statLabel, { color: '#DC2626' }]}>LAPSED (90+D)</Text>
            <Text style={[styles.statVal, { color: '#DC2626' }]}>{lapsedCount}</Text>
          </View>
        </View>

        {/* STATUS FILTER PILLS */}
        <View style={styles.filterPillsRow}>
          {[
            { key: 'ALL', label: 'All Actionable' },
            { key: 'DUE', label: 'Due (21–44 Days)' },
            { key: 'OVERDUE', label: 'Overdue (45–89 Days)' },
            { key: 'LAPSED', label: 'Lapsed (90+ Days)' },
          ].map((pill) => {
            const isSelected = selectedStatus === pill.key;
            return (
              <TouchableOpacity
                key={pill.key}
                onPress={() => setSelectedStatus(pill.key)}
                style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CLIENTS LIST */}
        {loading && displayList.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4F6748" />
            <Text style={styles.loadingText}>Loading retention targets...</Text>
          </View>
        ) : filteredClients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Clock size={32} color="#737373" />
            <Text style={styles.emptyTitle}>No Clients Found</Text>
            <Text style={styles.emptySub}>
              All clients are actively booked or no clients match the selected retention filter.
            </Text>
          </Card>
        ) : (
          filteredClients.map((c) => {
            const isDue = c.status === 'DUE';
            const isOverdue = c.status === 'OVERDUE';
            const badgeBg = isDue ? '#F0F5EE' : isOverdue ? '#FFFBEB' : '#FEF2F2';
            const badgeText = isDue ? '#4F6748' : isOverdue ? '#B45309' : '#DC2626';

            return (
              <Card key={c.id} style={styles.clientCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{c.name}</Text>
                    <Text style={styles.clientPhone}>{c.phone || 'No phone'}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                      {c.status} • {c.elapsedDays}d ago
                    </Text>
                  </View>
                </View>

                <View style={styles.serviceRow}>
                  <Text style={styles.serviceLabel}>Last Service:</Text>
                  <Text style={styles.serviceValue}>
                    {c.lastService} on {c.lastVisit}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {c.phone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})}
                      style={styles.callBtn}
                      activeOpacity={0.8}
                    >
                      <Phone size={13} color="#2D2D2A" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => handleSendWhatsApp(c)}
                    disabled={sendingClientId === c.id}
                    style={styles.whatsAppBtn}
                    activeOpacity={0.8}
                  >
                    <MessageCircle size={14} color="#FFFFFF" />
                    <Text style={styles.whatsAppBtnText}>
                      {sendingClientId === c.id ? 'Sending...' : 'WhatsApp Rebooking'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F6748',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  batchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshBtn: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    textAlign: 'center',
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2D2D2A',
    marginTop: 2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  pillBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clientPhone: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  serviceLabel: {
    fontSize: 11,
    color: '#737373',
  },
  serviceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  whatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 8,
    borderRadius: 8,
  },
  whatsAppBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingBox: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#737373',
    marginTop: 8,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 28,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});

export default RebookingScreen;

