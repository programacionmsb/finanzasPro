import { createStackNavigator } from '@react-navigation/stack';
import { SplashScreen }    from '../screens/auth/SplashScreen';
import { LoginScreen }     from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { AuthStackParamList } from '../types/navigation';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash"      component={SplashScreen} />
      <Stack.Screen name="Login"       component={LoginScreen} />
      <Stack.Screen name="Onboarding"  component={OnboardingScreen} />
    </Stack.Navigator>
  );
}
