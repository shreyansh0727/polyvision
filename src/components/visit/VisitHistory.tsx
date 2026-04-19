// src/components/visit/VisitHistory.tsx
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { VisitPhoto } from '../../types';
import VisitCard      from './VisitCard';
import { MC, MF }     from '../../navigation/AppTheme';

interface Props {
  visits:  VisitPhoto[];
  loading: boolean;
}

export default function VisitHistory({ visits, loading }: Props) {
  const isEmpty = !loading && visits.length === 0;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Recent Visits</Text>

      {/* Loading */}
      {loading && visits.length === 0 && (
        <ActivityIndicator color={MC.green} style={styles.loader} />
      )}

      {/* Empty state */}
      {isEmpty && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No visits logged yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the button above to log your first visit
          </Text>
        </View>
      )}

      {/* Visit cards */}
      {visits.map((item) => (
        <VisitCard key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },
  loader: { marginTop: 20 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: MC.textSub,
    fontFamily: MF.display,
  },
  emptySubtext: {
    fontSize: 11,
    color: MC.textFaint,
    textAlign: 'center',
    fontFamily: MF.mono,
    maxWidth: 260,
  },
});