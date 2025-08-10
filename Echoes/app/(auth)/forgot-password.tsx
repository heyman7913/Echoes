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
  const [step, setStep] = useState(1); // 1: email input, 2: OTP verification
  const [verificationCode, setVerificationCode] = useState("");

  const handleSendCode = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    
    console.log('Attempting to send OTP to:', email);
    
    // Use signInWithOtp to get numeric OTP instead of magic link
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // Don't create user if they don't exist
        emailRedirectTo: undefined, // No redirect URL - forces OTP
      }
    });
    
    console.log('OTP response:', { data, error });
    
    if (error) {
      console.error('OTP Error:', error);
      setError(error.message);
    } else {
      console.log('OTP sent successfully');
      setSuccess("6-digit verification code sent to your email!");
      setStep(2);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    setError("");
    
    // Verify the numeric OTP code
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode,
      type: 'email' // Use 'email' type for OTP verification
    });

    if (verifyError) {
      setError("Invalid verification code. Please check and try again.");
      setLoading(false);
      return;
    }

    // User is now authenticated, set flag that they must change password
    const { error: updateError } = await supabase.auth.updateUser({
      data: { must_change_password: true }
    });

    if (updateError) {
      console.error("Failed to set password change flag:", updateError);
    }

    // Navigate to set new password screen
    router.push("/(auth)/set-new-password");
    
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text variant="headlineMedium" style={{ marginBottom: 20 }}>
        {step === 1 ? "Forgot Password" : "Verify Code"}
      </Text>
      
      {step === 1 ? (
        // Step 1: Email input
        <>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ marginBottom: 16 }}
          />
          {error ? <Text style={{ color: "red", marginBottom: 16 }}>{error}</Text> : null}
          {success ? <Text style={{ color: "green", marginBottom: 16 }}>{success}</Text> : null}
          
          <Button
            mode="contained"
            onPress={handleSendCode}
            loading={loading}
            style={{ marginBottom: 16 }}
          >
            Send Verification Code
          </Button>
        </>
      ) : (
        // Step 2: OTP verification
        <>
          <Text style={{ marginBottom: 16, fontSize: 16 }}>
            Enter the verification code sent to {email}
          </Text>
          
          <TextInput
            label="Verification Code"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="numeric"
            style={{ marginBottom: 16 }}
            maxLength={6}
          />
          
          {error ? <Text style={{ color: "red", marginBottom: 16 }}>{error}</Text> : null}
          {success ? <Text style={{ color: "green", marginBottom: 16 }}>{success}</Text> : null}
          
          <Button
            mode="contained"
            onPress={handleVerifyOTP}
            loading={loading}
            style={{ marginBottom: 16 }}
          >
            Verify Code
          </Button>
          
          <Button 
            onPress={() => {
              setStep(1);
              setError("");
              setSuccess("");
            }}
            style={{ marginBottom: 8 }}
          >
            Back to Email
          </Button>
        </>
      )}
      
      <Button onPress={() => router.push("/(auth)/login")}>
        Back to Login
      </Button>
    </View>
  );
}
