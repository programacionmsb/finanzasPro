import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type BadgeVariant = 'ingreso' | 'egreso' | 'pendiente' | 'transferencia';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  style?: ViewStyle;
}

const CONFIG: Record<BadgeVariant, { bg: string; text: string; defaultLabel: string }> = {
  ingreso:       { bg: Colors.verdeLight, text: Colors.verde,    defaultLabel: '↑ Ingreso' },
  egreso:        { bg: Colors.rojoLight,  text: Colors.rojo,     defaultLabel: '↓ Egreso' },
  pendiente:     { bg: '#FFF8E7',         text: Colors.amarillo, defaultLabel: '⏳ Pendiente' },
  transferencia: { bg: Colors.celesteLight, text: Colors.celeste, defaultLabel: '⇄ Transferencia' },
};

export function Badge({ variant, label, style }: BadgeProps) {
  const { bg, text, defaultLabel } = CONFIG[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: text }]}>
        {label ?? defaultLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
});
