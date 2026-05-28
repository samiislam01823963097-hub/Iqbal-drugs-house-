import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Database Instance ID matching configuration
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Export Auth instance
export const auth = getAuth();

// Test Connection Routine on load to verify rules and setup correctness
export async function testFirestoreConnection() {
  try {
    // Attempt an anonymous sign in to establish credentials for requests
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    // Test read ping to confirm online connectivity is secure
    await getDocFromServer(doc(db, 'test', 'ping'));
    console.log('Firebase connection verified and authenticated successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection test skipped (currently in Offline mode).');
    } else {
      console.error('Firebase Auth/Connection verification resulted in:', error);
    }
  }
}
