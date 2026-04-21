import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

import { updateStat } from './stats';

export const logUserActivity = async (
  profile: UserProfile | null | undefined,
  action: string,
  details: string
) => {
  if (!profile) return;
  try {
    await addDoc(collection(db, 'user_activities'), {
      userId: profile.uid,
      userName: profile.displayName || 'Unknown',
      userEmail: profile.email || 'Unknown',
      action,
      details,
      timestamp: Date.now()
    });
    // Atomic increment of logs counter
    await updateStat('totalLogs', 1);
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
};
