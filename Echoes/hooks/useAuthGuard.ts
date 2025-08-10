import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../supabase/client';

export function useAuthGuard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          const mustChangePassword = session.user.user_metadata?.must_change_password;
          
          // If user must change password, only allow set-new-password screen
          if (mustChangePassword) {
            const currentPath = segments.join('/');
            if (!currentPath.includes('set-new-password')) {
              router.replace('/(auth)/set-new-password');
            }
          } else {
            // User is authenticated and doesn't need to change password
            const inAuthGroup = segments[0] === '(auth)';
            if (inAuthGroup) {
              router.replace('/(tabs)/memories');
            }
          }
        } else {
          // User is not authenticated
          const inAuthGroup = segments[0] === '(auth)';
          if (!inAuthGroup) {
            router.replace('/(auth)/login');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [segments]);

  return { user, loading };
}
