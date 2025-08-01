import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";

export default function MemoriesScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text variant="headlineMedium">Therapist Screen</Text>
      <Text>Your saved memories will appear here.</Text>
    </View>
  );
}
