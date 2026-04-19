// src/navigation/sharedTabOptions.ts
import { Platform } from 'react-native';
import { tokens, MC, MF } from './AppTheme';

/**
 * Shared screenOptions for both EmployeeTabs and AdminTabs.
 *
 * Usage:
 *   const scheme = useColorScheme();
 *   <Tab.Navigator screenOptions={sharedTabOptions(scheme)}>
 */
export function sharedTabOptions(scheme: 'light' | 'dark' | null | undefined) {
  const isDark = scheme === 'dark';

  return {
    tabBarActiveTintColor: isDark ? MC.green : tokens.light.teal,
    tabBarInactiveTintColor: isDark ? MC.textSub : tokens.light.textMuted,

    tabBarStyle: {
      backgroundColor: isDark ? MC.surface : tokens.light.card,
      borderTopColor:  isDark ? MC.border : tokens.light.border,
      borderTopWidth:  1,
      height:          Platform.OS === 'ios' ? 84 : 64,
      paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
      paddingTop:      8,
      elevation:       0,
      shadowOpacity:   0,
    },

    tabBarLabelStyle: {
      fontSize:   11,
      fontWeight: '700' as const,
      marginTop:  2,
      fontFamily: MF.mono,
      letterSpacing: 0.3,
    },

    headerStyle: {
      backgroundColor:   isDark ? MC.surface : tokens.light.card,
      borderBottomColor: isDark ? MC.border : tokens.light.border,
      borderBottomWidth: 1,
      elevation:         0,
      shadowOpacity:     0,
    },

    headerTitleStyle: {
      fontSize:   17,
      fontWeight: '800' as const,
      color:      isDark ? MC.textPrimary : tokens.light.text,
      fontFamily: isDark ? MF.display : undefined,
    },

    headerTintColor: isDark ? MC.green : tokens.light.teal,

    sceneStyle: {
      backgroundColor: isDark ? MC.bg : tokens.light.bg,
    },
  } as const;
}