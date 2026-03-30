import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator }  from './AppNavigator';
import { RootStackParamList } from '../types/navigation';
import { useAppStore } from '../store/useAppStore';

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Navigator raíz — state-driven.
 * Muestra AuthNavigator si no hay usuario logueado,
 * AppNavigator en cuanto store.usuario se establece.
 * La transición es automática sin navigate() manual.
 */
export function RootNavigator() {
  const usuario = useAppStore(s => s.usuario);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      {usuario ? (
        <Stack.Screen name="App"  component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
