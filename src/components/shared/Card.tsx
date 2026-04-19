// src/components/shared/Card.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';

interface Props {
  children:    React.ReactNode;
  title?:      string;           // optional header title
  subtitle?:   string;           // optional header subtitle
  rightAction?: {                // optional top-right button
    label:   string;
    onPress: () => void;
  };
  onPress?:    () => void;       // makes entire card tappable
  style?:      ViewStyle;
  padded?:     boolean;          // false = no inner padding (for image cards)
}

export default function Card({
  children,
  title,
  subtitle,
  rightAction,
  onPress,
  style,
  padded = true,
}: Props) {
  const hasHeader = title || rightAction;

  const content = (
    <View style={[styles.card, !padded && styles.noPadding, style]}>

      {/* ── Optional header row ── */}
      {hasHeader && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && (
              <Text style={styles.title}>{title}</Text>
            )}
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
          </View>
          {rightAction && (
            <TouchableOpacity
              onPress={rightAction.onPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.rightAction}>{rightAction.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Card body ── */}
      {children}

    </View>
  );

  // Wrap in TouchableOpacity if onPress provided
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[styles.card, !padded && styles.noPadding, style]}
      >
        {hasHeader && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {title    && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {rightAction && (
              <TouchableOpacity onPress={rightAction.onPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.rightAction}>{rightAction.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {children}
      </TouchableOpacity>
    );
  }

  return content;
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius:    14,
    padding:         20,
    gap:             12,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  noPadding: {
    padding: 0,
    overflow: 'hidden',  // clips image corners inside card
  },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  headerText:   { flex: 1, gap: 2 },
  title:        { fontSize: 15, fontWeight: '700', color: '#28251d' },
  subtitle:     { fontSize: 12, color: '#7a7974' },
  rightAction:  { fontSize: 13, color: '#01696f', fontWeight: '600' },
});