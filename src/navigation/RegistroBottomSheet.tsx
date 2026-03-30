import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../components/ui/BottomSheet';
import { AppStackParamList } from '../types/navigation';
import { Colors } from '../constants/Colors';
import { Fonts } from '../constants/Fonts';

type Nav = StackNavigationProp<AppStackParamList>;

type Modo = 'compartir' | 'foto' | 'manual';

const OPCIONES: { modo: Modo; icono: keyof typeof Ionicons.glyphMap; label: string; desc: string; color: string }[] = [
  {
    modo:  'compartir',
    icono: 'share-social-outline',
    label: 'Compartir desde app',
    desc:  'Recibir texto desde Yape, Plin o apps bancarias',
    color: Colors.morado,
  },
  {
    modo:  'foto',
    icono: 'camera-outline',
    label: 'Desde foto / galería',
    desc:  'Selecciona una captura de pantalla para OCR',
    color: Colors.celeste,
  },
  {
    modo:  'manual',
    icono: 'create-outline',
    label: 'Ingresar manualmente',
    desc:  'Formulario rápido de ingreso o egreso',
    color: Colors.verde,
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RegistroBottomSheet({ visible, onClose }: Props) {
  const navigation = useNavigation<Nav>();

  function handleSelect(modo: Modo) {
    onClose();
    // Pequeño delay para que el BottomSheet cierre antes de navegar
    setTimeout(() => navigation.navigate('Registro', { modo }), 150);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <Text style={styles.title}>Registrar movimiento</Text>
        {OPCIONES.map(({ modo, icono, label, desc, color }) => (
          <TouchableOpacity
            key={modo}
            style={styles.opcion}
            onPress={() => handleSelect(modo)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrapper, { backgroundColor: color + '1A' }]}>
              <Ionicons name={icono} size={24} color={color} />
            </View>
            <View style={styles.opcionText}>
              <Text style={styles.opcionLabel}>{label}</Text>
              <Text style={styles.opcionDesc}>{desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gris} />
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.texto,
    marginBottom: 16,
    textAlign: 'center',
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 14,
    backgroundColor: Colors.fondo,
    marginBottom: 8,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionText: {
    flex: 1,
    gap: 2,
  },
  opcionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.texto,
  },
  opcionDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
});
