import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { supabase } from "../../supabase/client";
import { useRouter } from "expo-router";

export default function SignupScreen({ navigation }: any) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a confirmation link!");
      // Optionally redirect to login after signup
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 2000);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text variant="headlineMedium">Sign Up</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ marginBottom: 8 }}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ marginBottom: 8 }}
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      {success ? <Text style={{ color: "green" }}>{success}</Text> : null}
      <Button
        mode="contained"
        onPress={handleSignup}
        loading={loading}
        style={{ marginBottom: 8 }}
      >
        Sign Up
      </Button>
      <Button onPress={() => router.push("/(auth)/login")}>
        Already have an account? Login
      </Button>
    </View>
  );
}
