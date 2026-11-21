/**
 * ClientsListScreen — 1-to-1 Match with Omega Spa POS ClientsList.jsx
 * Matches frontend/src/pages/ClientsList.jsx:
 * - Header: "Clients" | Subtitle: "Manage client profiles and service history." | Action: "+ New Client"
 * - Search bar: "Search by Name / Phone"
 * - Filter Chips: "All Clients (X)", "Active Clients (Y)", "Inactive Clients (Z)", "Introduced by Me (W)"
 * - Client Cards: Avatar initial, Name, Phone (monospace), Quartier, Introduced by, Visits, 1-tap Call & WhatsApp, View File
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  Platform,
} from 'react-native';
import {
  Search,
  UserPlus,
  Phone,
  MessageSquare,
  User as UserIcon,
  ChevronRight,
  X,
  Users,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { useClients, Client } from '../context/ClientsContext';
import { useAuth } from '../context/AuthContext';
import { formatFCFA } from '../utils/currency';

interface ClientsListScreenProps {
  onSelectClient?: (client: Client) => void;
  onAddClient?: () => void;
  onOpenMenu?: () => void;
}

export const ClientsListScreen: React.FC<ClientsListScreenProps> = ({
  onSelectClient,
  onAddClient,
  onOpenMenu,
}) => {
  const { user } = useAuth();
  const { clients, loading, refreshClients, searchClientsApi } = useClients();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'mine'>('all');
  const [serverResults, setServerResults] = useState<Client[]>([]);

  // Debounced server search for live DB queries
  useEffect(() => {
    if (!search || search.trim().length < 2) {
      setServerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchClientsApi(search);
        setServerResults(results);
      } catch (e) {}
    }, 200);
    return () => clearTimeout(timer);
  }, [search, searchClientsApi]);

  const myClients = useMemo(() => {
    return clients.filter(
      (c) =>
        (c.introducedById && String(c.introducedById) === String(user?.id)) ||
        (c.introducedBy && user?.name && c.introducedBy.toLowerCase() === user.name.toLowerCase())
    );
  }, [clients, user]);

  const activeCount = useMemo(
    () => clients.filter((c) => c.status !== 'INACTIVE' && c.isActive !== false).length,
    [clients]
  );

  const inactiveCount = useMemo(
    () => clients.filter((c) => c.status === 'INACTIVE' || c.isActive === false).length,
    [clients]
  );

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    const cleanQ = q.replace(/[\s\-\+]/g, '');

    const list = clients.filter((c) => {
      // Filter tab
      if (filterType === 'active') {
        if (c.status === 'INACTIVE' || c.isActive === false) return false;
      } else if (filterType === 'inactive') {
        if (c.status !== 'INACTIVE' && c.isActive !== false) return false;
      } else if (filterType === 'mine') {
        const isMine =
          (c.introducedById && String(c.introducedById) === String(user?.id)) ||
          (c.introducedBy && user?.name && c.introducedBy.toLowerCase() === user.name.toLowerCase());
        if (!isMine) return false;
      }

      // Search query
      if (q) {
        const matchName = c.name && c.name.toLowerCase().includes(q);
        const cleanPhone = (c.phone || '').replace(/[\s\-\+]/g, '');
        const matchPhone = cleanQ.length > 0 && cleanPhone.includes(cleanQ);
        const matchQuartier = c.quartier && c.quartier.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchQuartier) return false;
      }

      return true;
    });

    // Merge server results if any
    const existingIds = new Set(list.map((c) => c.id));
    const extra = serverResults.filter((c) => !existingIds.has(c.id));
    return [...list, ...extra];
  }, [clients, filterType, search, user, serverResults]);

  const handleCall = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleWhatsApp = (phone: string) => {
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${clean}`).catch(() => {});
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Clients', count: clients.length },
    { id: 'active', label: 'Active Clients', count: activeCount },
    { id: 'inactive', label: 'Inactive Clients', count: inactiveCount },
    { id: 'mine', label: 'Introduced by Me', count: myClients.length },
  ];

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 match with Web Software */}
      <Header
        title="Clients"
        subtitle="Manage client profiles and service history."
        onOpenMenu={onOpenMenu}
        rightAction={
          onAddClient ? (
            <TouchableOpacity
              onPress={onAddClient}
              style={styles.addClientBtn}
              activeOpacity={0.8}
            >
              <UserPlus size={15} color="#FFFFFF" />
              <Text style={styles.addClientBtnText}>+ New Client</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Search Bar & Filter Chips Toolbar */}
      <View style={styles.toolbarArea}>
        <View style={styles.searchBar}>
          <Search size={16} color="#737373" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by Name / Phone"
            placeholderTextColor="#737373"
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <X size={14} color="#737373" />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterTabs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterTabsList}
          renderItem={({ item }) => {
            const isSelected = filterType === item.id;
            return (
              <TouchableOpacity
                onPress={() => setFilterType(item.id as any)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {item.label} ({item.count})
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Client List */}
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshClients}
            tintColor={THEME.colors.primaryDark}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Users size={36} color="#737373" />
            <Text style={styles.emptyTitle}>No clients found</Text>
            <Text style={styles.emptySub}>
              {search ? 'Try clearing your search query.' : 'Click "+ New Client" to register a client.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = item.status !== 'INACTIVE' && item.isActive !== false;
          const initial = (item.name || 'C').charAt(0).toUpperCase();

          return (
            <TouchableOpacity
              onPress={() => onSelectClient?.(item)}
              style={styles.clientCard}
              activeOpacity={0.8}
            >
              <View style={styles.cardTopRow}>
                {/* Avatar Initial Circle */}
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                {/* Name & Phone */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientPhone}>{item.phone || 'No phone'}</Text>
                  {item.quartier ? (
                    <Text style={styles.clientQuartier}>{item.quartier}</Text>
                  ) : null}
                </View>

                {/* Status Badge */}
                <Badge
                  label={isActive ? 'Active' : 'Inactive'}
                  variant={isActive ? 'success' : 'muted'}
                />
              </View>

              {/* Sub Row: Introduced by, Visits */}
              <View style={styles.cardBottomRow}>
                <View style={{ flex: 1 }}>
                  {item.introducedBy ? (
                    <Text style={styles.introducedByText}>
                      Ref: <Text style={{ fontWeight: '700', color: '#4F6748' }}>{item.introducedBy}</Text>
                    </Text>
                  ) : (
                    <Text style={styles.visitsText}>
                      {item.totalVisits || 0} visits · {formatFCFA(item.totalSpend || 0)}
                    </Text>
                  )}
                </View>

                {/* Actions: Call, WhatsApp, View File */}
                <View style={styles.actionButtonsRow}>
                  {item.phone ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleCall(item.phone)}
                        style={styles.contactBtn}
                        activeOpacity={0.7}
                      >
                        <Phone size={13} color="#4F6748" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleWhatsApp(item.phone)}
                        style={styles.contactBtn}
                        activeOpacity={0.7}
                      >
                        <MessageSquare size={13} color="#25D366" />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => onSelectClient?.(item)}
                    style={styles.viewFileBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewFileText}>View File →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2', // Warm Ivory (#FBF7F2) matching web app body
  },
  addClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8B9E82', // Sage Green (#8B9E82) matching web app "+ New Client"
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 11,
    ...THEME.shadows.sm,
  },
  addClientBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbarArea: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
    paddingVertical: 0,
  },
  filterTabsList: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  filterChipActive: {
    backgroundColor: '#DCE7D7', // Sage soft
    borderColor: '#8B9E82',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  filterChipTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  listContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 32,
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 12,
    ...THEME.shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCE7D7',
    borderWidth: 1,
    borderColor: '#A7B89A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F6748',
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clientPhone: {
    fontSize: 11,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  clientQuartier: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4EFEA',
  },
  introducedByText: {
    fontSize: 11,
    color: '#737373',
  },
  visitsText: {
    fontSize: 11,
    color: '#737373',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  viewFileBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  viewFileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default ClientsListScreen;
