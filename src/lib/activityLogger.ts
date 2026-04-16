import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

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
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
};
