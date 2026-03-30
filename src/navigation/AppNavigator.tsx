import { createStackNavigator } from '@react-navigation/stack';
import { TabNavigator }         from './TabNavigator';
import { RegistroScreen }       from '../screens/registro/RegistroScreen';
import { HistorialScreen }      from '../screens/historial/HistorialScreen';
import { AjustesScreen }        from '../screens/ajustes/AjustesScreen';
import { ConciliacionScreen }   from '../screens/cuentas/ConciliacionScreen';
import { CategoriaFormScreen }  from '../screens/categorias/CategoriaFormScreen';
import { AppStackParamList }    from '../types/navigation';
import { Colors } from '../constants/Colors';
import { Fonts }  from '../constants/Fonts';

const Stack = createStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: Colors.azul },
        headerTintColor:  Colors.blanco,
        headerTitleStyle: { fontFamily: Fonts.semiBold, fontSize: 17 },
        headerBackTitle:  'Atrás',
        cardStyle:        { backgroundColor: Colors.fondo },
      }}
    >
      {/* Tab principal — sin header */}
      <Stack.Screen
        name="TabNavigator"
        component={TabNavigator}
        options={{ headerShown: false }}
      />

      {/* Modal de registro — pantalla completa sin tab bar */}
      <Stack.Screen
        name="Registro"
        component={RegistroScreen}
        options={{
          title: 'Nuevo Movimiento',
          presentation: 'modal',
          headerStyle: { backgroundColor: Colors.blanco },
          headerTintColor: Colors.azul,
          headerTitleStyle: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.azul },
        }}
      />

      <Stack.Screen
        name="Historial"
        component={HistorialScreen}
        options={{ title: 'Historial' }}
      />

      <Stack.Screen
        name="Ajustes"
        component={AjustesScreen}
        options={{ title: 'Ajustes' }}
      />

      <Stack.Screen
        name="Conciliacion"
        component={ConciliacionScreen}
        options={{ title: 'Verificar Saldo' }}
      />

      <Stack.Screen
        name="CategoriaForm"
        component={CategoriaFormScreen}
        options={{ title: 'Categoría' }}
      />
    </Stack.Navigator>
  );
}
