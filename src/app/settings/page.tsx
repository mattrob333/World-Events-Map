import type { Metadata } from 'next';
import { Settings } from '@/components/community/Settings';

export const metadata: Metadata = { title: 'Settings · dope.travel' };

export default function SettingsPage() {
  return <Settings />;
}
