import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onHide: () => void;
}

const CONFIG: Record<ToastVariant, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  success: { bg: Colors.verde,   icon: 'checkmark-circle',  iconColor: Colors.blanco },
  error:   { bg: Colors.rojo,    icon: 'close-circle',      iconColor: Colors.blanco },
  info:    { bg: Colors.celeste, icon: 'information-circle', iconColor: Colors.blanco },
  warning: { bg: Colors.amarillo,icon: 'warning',            iconColor: Colors.blanco },
};

const { width } = Dimensions.get('window');

export function Toast({
  visible,
  message,
  variant = 'success',
  duration = 3000,
  onHide,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const { bg, icon, iconColor } = CONFIG[variant];

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [translateY, opacity, onHide]);

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(hide, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, translateY, opacity, hide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bg, transform: [{ translateY }], opacity },
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

// Hook de conveniencia para gestionar el estado del Toast
import { useState } from 'react';

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    variant: 'success',
  });

  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ visible: true, message, variant });
  }, []);

  const hide = useCallback(() => {
    setToast(t => ({ ...t, visible: false }));
  }, []);

  return { toast, show, hide };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.blanco,
  },
});
