// src/navigation/TabIcon.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { type LucideIcon }           from 'lucide-react-native';
import { MC }                        from './AppTheme';

interface Props {
  Icon:    LucideIcon;
  focused: boolean;
  color:   string;   // passed by tab navigator (active/inactive tint)
}

export default function TabIcon({ Icon, focused, color }: Props) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue:         focused ? 1.15 : 1,
      friction:        6,
      tension:         180,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Icon
        size={22}
        color={color}
        strokeWidth={focused ? 2.2 : 1.6}
      />
      {focused && (
        <View style={[styles.dot, { backgroundColor: MC.green }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems:  'center',
    gap:          3,
  },
  dot: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },
});