import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { Cuenta } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

interface CuentaSelectorProps {
  cuentas:    Cuenta[];
  value:      number | null;
  onChange:   (id: number) => void;
  label?:     string;
  moneda?:    string;
}

export function CuentaSelector({
  cuentas, value, onChange, label = 'Cuenta', moneda = 'PEN',
}: CuentaSelectorProps) {
  const [open, setOpen] = require('react').useState(false);
  const selected = cuentas.find(c => c.id === value);

  return (
    <View>
      {label && <Text style={st.label}>{label}</Text>}

      <TouchableOpacity style={st.trigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        {selected ? (
          <View style={st.triggerRow}>
            <View style={[st.triggerIcon, { backgroundColor: selected.color + '22' }]}>
              <Text>{selected.icono}</Text>
            </View>
            <Text style={st.triggerText}>{selected.nombre}</Text>
          </View>
        ) : (
          <Text style={st.triggerPlaceholder}>Selecciona una cuenta</Text>
        )}
        <Ionicons name="chevron-down" size={18} color={Colors.gris} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight={400}>
        <ScrollView contentContainerStyle={st.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={st.sheetTitle}>Seleccionar cuenta</Text>
          {cuentas.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[st.item, value === c.id && st.itemSelected]}
              onPress={() => { onChange(c.id); setOpen(false); }}
              activeOpacity={0.7}
            >
              <View style={[st.itemIcon, { backgroundColor: c.color + '22' }]}>
                <Text style={st.itemIconText}>{c.icono}</Text>
              </View>
              <Text style={st.itemName}>{c.nombre}</Text>
              {value === c.id && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.celeste} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  triggerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  triggerIcon:        { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  triggerText:        { fontFamily: Fonts.medium, fontSize: 15, color: Colors.texto },
  triggerPlaceholder: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.gris },
  sheetContent:       { paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  sheetTitle:         { fontFamily: Fonts.bold, fontSize: 17, color: Colors.texto, textAlign: 'center', marginBottom: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, backgroundColor: Colors.fondo,
  },
  itemSelected:   { backgroundColor: Colors.celesteLight },
  itemIcon:       { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemIconText:   { fontSize: 20 },
  itemName:       { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.texto },
});
