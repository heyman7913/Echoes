import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { supabase } from "../../supabase/client";
import { useRouter } from "expo-router";

export default function ForgotPasswordScreen({ navigation }: any) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleReset = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password reset email sent! Check your inbox.");
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text variant="headlineMedium">Forgot Password</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ marginBottom: 8 }}
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      {success ? <Text style={{ color: "green" }}>{success}</Text> : null}
      <Button
        mode="contained"
        onPress={handleReset}
        loading={loading}
        style={{ marginBottom: 8 }}
      >
        Send Reset Email
      </Button>
      <Button onPress={() => router.push("/(auth)/login")}>
        Back to Login
      </Button>
    </View>
  );
}
