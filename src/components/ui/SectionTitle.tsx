import { Text, StyleSheet, TextStyle } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

interface SectionTitleProps {
  children: string;
  style?: TextStyle;
}

export function SectionTitle({ children, style }: SectionTitleProps) {
  return (
    <Text style={[styles.title, style]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.gris,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
});
