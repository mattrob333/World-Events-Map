import type { Metadata } from 'next';
import { PeopleDirectory } from '@/components/people/People';
import { PeopleHome } from '@/components/people/PeopleHome';

export const metadata: Metadata = { title: 'Your people · dope.travel' };

export default function PeoplePage() {
  return (
    <>
      <PeopleHome />
      <PeopleDirectory />
    </>
  );
}
