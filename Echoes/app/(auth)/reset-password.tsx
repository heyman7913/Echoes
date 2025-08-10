import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { supabase } from "../../supabase/client";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Handle the reset password tokens from URL
    const { access_token, refresh_token, type } = params;
    
    if (type === 'recovery' && access_token && refresh_token) {
      // Set the session with the tokens from the email link
      supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string,
      });
    }
  }, [params]);

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated successfully!");
      setTimeout(() => {
        router.replace("/(tabs)/memories");
      }, 2000);
    }
    
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text variant="headlineMedium" style={{ marginBottom: 20 }}>
        Reset Your Password
      </Text>
      
      <TextInput
        label="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={{ marginBottom: 16 }}
      />
      
      <TextInput
        label="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={{ marginBottom: 16 }}
      />
      
      {error ? <Text style={{ color: "red", marginBottom: 16 }}>{error}</Text> : null}
      {success ? <Text style={{ color: "green", marginBottom: 16 }}>{success}</Text> : null}
      
      <Button
        mode="contained"
        onPress={handleResetPassword}
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        Update Password
      </Button>
      
      <Button onPress={() => router.push("/(auth)/login")}>
        Back to Login
      </Button>
    </View>
  );
}
