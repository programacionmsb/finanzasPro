import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../types/navigation';
import { ManualPanel } from './ManualPanel';
import { SharePanel } from './SharePanel';
import { FotoPanel } from './FotoPanel';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AppStackParamList, 'Registro'>;

type Modo = 'manual' | 'foto' | 'compartir';

const TABS: { key: Modo; label: string; icon: string }[] = [
  { key: 'compartir', label: 'Compartir',  icon: 'share-social-outline' },
  { key: 'foto',      label: 'Foto / OCR', icon: 'camera-outline'       },
  { key: 'manual',    label: 'Manual',     icon: 'create-outline'        },
];

const TAB_COLOR: Record<Modo, string> = {
  compartir: Colors.morado,
  foto:      Colors.celeste,
  manual:    Colors.verde,
};

export function RegistroScreen({ navigation, route }: Props) {
  const [modo, setModo] = useState<Modo>(route.params?.modo ?? 'manual');

  useEffect(() => {
    if (route.params?.modo) setModo(route.params.modo);
  }, [route.params?.modo]);

  function handleSaved() {
    navigation.goBack();
  }

  return (
    <SafeAreaView style={st.safe}>
      {/* ── Barra de pestañas ──────────────────────── */}
      <View style={st.tabBar}>
        {TABS.map(tab => {
          const active = modo === tab.key;
          const color  = active ? TAB_COLOR[tab.key] : Colors.gris;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[st.tabBtn, active && { borderBottomColor: color, borderBottomWidth: 2.5 }]}
              onPress={() => setModo(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={tab.icon as any} size={20} color={color} />
              <Text style={[st.tabLabel, { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Panel activo ──────────────────────────── */}
      <View style={st.panel}>
        {modo === 'manual'    && <ManualPanel  onSaved={handleSaved} />}
        {modo === 'foto'      && <FotoPanel    onSaved={handleSaved} />}
        {modo === 'compartir' && <SharePanel   onSaved={handleSaved} />}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.fondo },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.blanco,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borde,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },

  panel: { flex: 1 },
});
