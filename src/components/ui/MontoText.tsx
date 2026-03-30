import { Text, StyleSheet, TextStyle } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { formatMonto } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import { MonedaCode } from '../../types';

interface MontoTextProps {
  monto: number;
  moneda?: MonedaCode;
  style?: TextStyle;
  /** Si se provee, colorea positivo en verde y negativo en rojo */
  colorize?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = { sm: 13, md: 16, lg: 22, xl: 32 };

export function MontoText({
  monto,
  moneda = 'PEN',
  style,
  colorize = false,
  size = 'md',
}: MontoTextProps) {
  const { amountsHidden, usuario } = useAppStore();
  const monedaActual = (moneda ?? usuario?.moneda ?? 'PEN') as MonedaCode;

  const color = colorize
    ? monto >= 0 ? Colors.verde : Colors.rojo
    : undefined;

  return (
    <Text
      style={[
        styles.base,
        { fontSize: SIZE_MAP[size] },
        color ? { color } : null,
        style,
      ]}
    >
      {amountsHidden ? '••••••' : formatMonto(monto, monedaActual)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts.mono,
    color: Colors.texto,
  },
});
