import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.base, isDisabled && styles.disabled, style]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#2A5BA8', Colors.azul]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading
            ? <ActivityIndicator color={Colors.blanco} />
            : <Text style={[styles.textPrimary, textStyle]}>{label}</Text>
          }
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles: Record<Exclude<ButtonVariant, 'primary'>, ViewStyle> = {
    secondary: { backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.celeste },
    ghost:     { backgroundColor: 'transparent' },
    danger:    { backgroundColor: Colors.rojoLight, borderWidth: 1.5, borderColor: Colors.rojo },
  };

  const variantTextColors: Record<Exclude<ButtonVariant, 'primary'>, string> = {
    secondary: Colors.celeste,
    ghost:     Colors.gris,
    danger:    Colors.rojo,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={variantTextColors[variant]} />
        : <Text style={[styles.textSecondary, { color: variantTextColors[variant] }, textStyle]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  textPrimary: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.blanco,
    letterSpacing: 0.3,
  },
  textSecondary: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.5,
  },
});
