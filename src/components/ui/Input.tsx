import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  containerStyle,
  rightIcon,
  onRightIconPress,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.focused,
          error ? styles.errorBorder : null,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.gris}
          onFocus={() => { console.log('[Input] onFocus', props.placeholder); setFocused(true); }}
          onBlur={() => { console.log('[Input] onBlur', props.placeholder); setFocused(false); }}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            accessibilityLabel="Acción del campo"
            style={styles.rightIcon}
          >
            <Ionicons name={rightIcon} size={20} color={Colors.gris} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.texto,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blanco,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.texto,
    paddingVertical: 13,
  },
  focused: {
    borderColor: Colors.celeste,
    shadowColor: Colors.celeste,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBorder: {
    borderColor: Colors.rojo,
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.rojo,
    marginTop: 4,
  },
  rightIcon: {
    padding: 4,
  },
});
