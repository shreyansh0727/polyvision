// src/components/tracking/StatsRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  battery:   number | null;
  role?:     string;
  isTracking: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────
function batteryColor(level: number): string {
  if (level > 50) return MC.green;
  if (level > 20) return MC.gold;
  return MC.rose;
}

function batteryIcon(level: number): string {
  if (level > 80) return '🔋';
  if (level > 20) return '🪫';
  return '⚠️';
}

// ── Single stat tile ──────────────────────────────────────────────
interface StatTileProps {
  label: string;
  icon:  string;
  value: string;
  valueColor?: string;
}

function StatTile({ label, icon, value, valueColor }: StatTileProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function StatsRow({ battery, role, isTracking }: Props) {
  const batteryVal   = battery != null ? `${battery}%` : '—';
  const batteryCol   = battery != null ? batteryColor(battery) : undefined;
  const batterySym   = battery != null ? batteryIcon(battery) : '—';
  const isAdmin      = role === 'admin';
  const statusLabel  = isTracking ? 'On Shift' : 'Off Shift';
  const statusColor  = isTracking ? MC.green : MC.textSub;
  const statusIcon   = isTracking ? '🟢' : '⚪';

  return (
    <View style={styles.statsRow}>
      {/* Battery */}
      <StatTile
        label="Battery"
        icon={batterySym}
        value={batteryVal}
        valueColor={batteryCol}
      />

      {/* Role */}
      <StatTile
        label="Role"
        icon={isAdmin ? '🛡️' : '👤'}
        value={isAdmin ? 'Admin' : 'Employee'}
      />

      {/* Status */}
      <StatTile
        label="Status"
        icon={statusIcon}
        value={statusLabel}
        valueColor={statusColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: MC.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: MC.border,
  },
  statLabel: {
    fontSize: 9,
    color: MC.textFaint,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: MF.mono,
  },
  statIcon: {
    fontSize: 20,
    marginVertical: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.mono,
  },
});