import { Suspense } from 'react';
import { LoginScreen } from '@/components/auth/LoginScreen';

export const metadata = { title: 'Log in · dope.travel' };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
