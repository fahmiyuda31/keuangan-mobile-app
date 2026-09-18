import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  titleStyle?: TextStyle;
  padding?: number;
  elevation?: number;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  title,
  titleStyle,
  padding = 18,
  elevation = 0,
}) => {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          padding,
          elevation,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {title && <Text style={[styles.title, { color: colors.text }, titleStyle]}>{title}</Text>}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
});

export default Card;
