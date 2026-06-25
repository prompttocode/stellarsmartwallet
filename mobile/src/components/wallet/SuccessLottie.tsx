import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

const successAnimation = require('@assets/lottie/Success.json');

export function SuccessLottie({
  size = 150,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LottieView
      autoPlay
      loop={false}
      source={successAnimation}
      duration={3000}
      style={[{ height: size, width: size }, style]}
    />
  );
}
