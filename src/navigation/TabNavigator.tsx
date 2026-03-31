import { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { DashboardScreen }  from '../screens/dashboard/DashboardScreen';
import { CuentasScreen }    from '../screens/cuentas/CuentasScreen';
import { CategoriasScreen } from '../screens/categorias/CategoriasScreen';
import { ReportesScreen }   from '../screens/reportes/ReportesScreen';
import { RegistroBottomSheet } from './RegistroBottomSheet';
import { TabParamList, AppStackParamList } from '../types/navigation';
import { Colors } from '../constants/Colors';
import { Fonts } from '../constants/Fonts';
import { useAppStore } from '../store/useAppStore';

const Tab = createBottomTabNavigator<TabParamList>();

// ── Botón central elevado ─────────────────────────────────────────────────
function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel="Registrar movimiento"
      style={styles.addButtonWrapper}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#4A90D9', Colors.azul]}
        style={styles.addButtonGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="add" size={30} color={Colors.blanco} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Factory para pasar el handler al tabBarButton
function makeAddTabButton(onPress: () => void) {
  return function AddTabButton(_props: BottomTabBarButtonProps) {
    return <AddButton onPress={onPress} />;
  };
}

// ── Tab Navigator ─────────────────────────────────────────────────────────
export function TabNavigator() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { bottom } = insets;
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const imagenCompartida = useAppStore(s => s.imagenCompartida);

  // Auto-navegar a FotoPanel cuando se recibe una imagen desde otra app
  useEffect(() => {
    if (imagenCompartida) {
      navigation.navigate('Registro', { modo: 'foto' });
    }
  }, [imagenCompartida]);
  console.log('[TabNav] insets completos:', JSON.stringify(insets));
  console.log('[TabNav] paddingBottom aplicado:', 8 + bottom);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, { paddingBottom: 8 + bottom }],
          tabBarActiveTintColor: Colors.azul,
          tabBarInactiveTintColor: Colors.gris,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Cuentas"
          component={CuentasScreen}
          options={{
            title: 'Cuentas',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Botón central — no navega, abre BottomSheet */}
        <Tab.Screen
          name="_AddButton"
          component={DashboardScreen} // componente nunca visible
          options={{
            title: '',
            tabBarButton: makeAddTabButton(() => setSheetVisible(true)),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault(); // evitar cualquier navegación
            },
          }}
        />

        <Tab.Screen
          name="Categorias"
          component={CategoriasScreen}
          options={{
            title: 'Categorías',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Reportes"
          component={ReportesScreen}
          options={{
            title: 'Reportes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      <RegistroBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.blanco,
    borderTopColor: Colors.borde,
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
  },
  addButtonWrapper: {
    top: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.azul,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
