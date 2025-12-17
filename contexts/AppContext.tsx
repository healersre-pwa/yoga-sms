
import React, { createContext, useContext, useState, useEffect, PropsWithChildren, useCallback } from 'react';
import { AppState, ClassSession, Instructor, User, UserRole, AppContextType } from '../types';
import { db, auth, firebaseConfig, googleProvider } from '../firebaseConfig';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  getAuth,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  QuerySnapshot,
  DocumentData,
  runTransaction,
  deleteField,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

const KEYS = {
  CURRENT_USER_ID: 'zenflow_current_user_id_v2',
  LOCAL_CLASSES: 'zenflow_local_classes_backup', 
  LOCAL_INSTRUCTORS: 'zenflow_local_instructors_backup',
  LOCAL_USERS: 'zenflow_local_users_backup',
  LOCAL_LOGO: 'zenflow_local_logo',
  LOCAL_BG: 'zenflow_local_bg'
};

// HARDCODED SUPER ADMIN ID
const SUPER_ADMIN_ID = 'lhkePobGB2WPMJT78kff1cYvx6K2';

const GUEST_USER: User = {
    id: 'guest',
    name: '訪客',
    role: UserRole.GUEST,
    avatarUrl: '',
    username: 'guest'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Helper function to generate sequential IDs (filling gaps)
const generateSequentialId = (prefix: string, existingIds: string[]): string => {
    const idSet = new Set(existingIds);
    let num = 1;
    while (idSet.has(`${prefix}${num}`)) {
        num++;
    }
    return `${prefix}${num}`;
};

// Helper: Safe Decimal Subtraction to avoid 0.3000000004 issues
const safeSubtract = (a: number, b: number) => {
    return Math.round((a - b) * 100) / 100;
};

export const AppProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  
  const [activeClasses, setActiveClasses] = useState<ClassSession[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<ClassSession[]>([]);
  const [hasFetchedArchived, setHasFetchedArchived] = useState(false);

  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Initialize from LocalStorage to prevent flash
  const [appLogo, setAppLogo] = useState<string | null>(() => {
      try { return localStorage.getItem(KEYS.LOCAL_LOGO); } catch { return null; }
  });
  const [appBackgroundImage, setAppBackgroundImage] = useState<string | null>(() => {
      try { return localStorage.getItem(KEYS.LOCAL_BG); } catch { return null; }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'firebase' | 'local'>('firebase');

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  
  const allClassesHistory = [...activeClasses, ...archivedClasses];

  // Robust safeStringify
  const saveToLocalBackup = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error(e); }
  };
  
  const loadFromLocalBackup = <T,>(key: string): T[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  };

  // --- FIREBASE AUTH LISTENER ---
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
              // User is signed in, fetch details from Firestore
              try {
                  const userDocRef = doc(db, 'users', firebaseUser.uid);
                  const userDoc = await getDoc(userDocRef);
                  
                  if (userDoc.exists()) {
                      const userData = userDoc.data() as User;
                      
                      // SECURITY FORCE: If this is the Super Admin ID, force the role to ADMIN
                      if (firebaseUser.uid === SUPER_ADMIN_ID) {
                          userData.role = UserRole.ADMIN;
                      }

                      setCurrentUser({ ...userData, id: firebaseUser.uid }); 
                  } else {
                      // Doc doesn't exist yet (e.g. halfway through Google Register)
                      // Do NOT set current user yet, let the UI handle the "Needs Phone" state
                      // Special case: Admin backup
                      if (firebaseUser.uid === SUPER_ADMIN_ID) {
                          const adminUser: User = {
                              id: firebaseUser.uid,
                              name: 'Super Admin',
                              role: UserRole.ADMIN,
                              email: firebaseUser.email || '',
                              username: 'admin',
                              avatarUrl: '',
                              hasPaid: true
                          };
                          setCurrentUser(adminUser);
                      } else {
                          // Standard user with no doc -> Treat as Guest until they finish registration
                          setCurrentUser(GUEST_USER);
                      }
                  }
              } catch (e) {
                  console.error("Error fetching user profile:", e);
              }
          } else {
              // User is signed out
              setCurrentUser(GUEST_USER);
          }
      });

      return () => unsubscribe();
  }, []);

  const fetchArchivedClasses = async () => {
      if (hasFetchedArchived) return; 
      try {
          const q = query(collection(db, 'classes'), where('archived', '==', true));
          const snapshot = await getDocs(q);
          const data: ClassSession[] = snapshot.docs.map(doc => ({
              ...(doc.data() as Omit<ClassSession, 'id'>),
              id: doc.id
          }));
          setArchivedClasses(data);
          setHasFetchedArchived(true);
      } catch (e) {
          console.error("Error fetching archived classes:", e);
      }
  };

  // ... (Prune function kept same)
  const pruneArchivedClasses = async (monthsToKeep: number): Promise<{ deletedDocs: number; cleanedRecords: number }> => {
      if (!hasFetchedArchived) await fetchArchivedClasses();
      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - monthsToKeep);
      const thresholdStr = formatDateKey(thresholdDate);
      let deletedDocs = 0;
      let cleanedRecords = 0;
      const toDelete = archivedClasses.filter(c => {
          const dateRef = c.archivedAt || c.createdAt;
          if (!dateRef) return false;
          return dateRef < thresholdStr;
      });
      try {
          const chunkSize = 400;
          for (let i = 0; i < toDelete.length; i += chunkSize) {
              const chunk = toDelete.slice(i, i + chunkSize);
              const batch = writeBatch(db);
              chunk.forEach(c => batch.delete(doc(db, 'classes', c.id)));
              await batch.commit();
              deletedDocs += chunk.length;
          }
          let activeOps = 0;
          let currentBatch = writeBatch(db);
          for (const c of activeClasses) {
              let changed = false;
              const newBookings = { ...c.bookings };
              const newSubstitutions = { ...c.substitutions };
              if (c.bookings) {
                  Object.keys(c.bookings).forEach(dateKey => {
                      if (dateKey < thresholdStr) {
                          const count = newBookings[dateKey].length;
                          delete newBookings[dateKey];
                          cleanedRecords += count;
                          changed = true;
                      }
                  });
              }
              if (c.substitutions) {
                  Object.keys(c.substitutions).forEach(dateKey => {
                      if (dateKey < thresholdStr) {
                          delete newSubstitutions[dateKey];
                          cleanedRecords++;
                          changed = true;
                      }
                  });
              }
              if (changed) {
                  currentBatch.update(doc(db, 'classes', c.id), { bookings: newBookings, substitutions: newSubstitutions });
                  activeOps++;
                  if (activeOps >= 400) { await currentBatch.commit(); currentBatch = writeBatch(db); activeOps = 0; }
              }
          }
          if (activeOps > 0) await currentBatch.commit();
          const deletedIds = new Set(toDelete.map(c => c.id));
          setArchivedClasses(prev => prev.filter(c => !deletedIds.has(c.id)));
          return { deletedDocs, cleanedRecords };
      } catch (e) { throw e; }
  };

  // --- 1. PUBLIC DATA SUBSCRIPTIONS (Classes, Instructors, Settings) ---
  useEffect(() => {
    let unsubClasses: () => void;
    let unsubInstructors: () => void;
    let unsubSettings: () => void;

    // SAFETY TIMEOUT: If Firebase takes too long, fallback to local backup
    const safetyTimeout = setTimeout(() => {
        setIsLoading(prev => {
            if (prev) {
                setDataSource('local');
                setActiveClasses(prevC => prevC.length === 0 ? loadFromLocalBackup(KEYS.LOCAL_CLASSES) : prevC);
                setInstructors(prevI => prevI.length === 0 ? loadFromLocalBackup(KEYS.LOCAL_INSTRUCTORS) : prevI);
                setAllUsers(prevU => prevU.length === 0 ? loadFromLocalBackup(KEYS.LOCAL_USERS) : prevU);
                return false;
            }
            return prev;
        });
    }, 3000);

    try {
        const activeClassesQuery = query(collection(db, 'classes'), where('archived', '==', false));
        unsubClasses = onSnapshot(activeClassesQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
            setActiveClasses(data);
            setDataSource('firebase');
            saveToLocalBackup(KEYS.LOCAL_CLASSES, data);
            
            // Once classes are loaded, we can consider the app 'ready' for display
            setIsLoading(false);
            clearTimeout(safetyTimeout);
        });

        unsubInstructors = onSnapshot(collection(db, 'instructors'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
            setInstructors(data);
            saveToLocalBackup(KEYS.LOCAL_INSTRUCTORS, data);
        });
        
        unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.logoUrl) setAppLogo(data.logoUrl);
                if (data.backgroundImageUrl) setAppBackgroundImage(data.backgroundImageUrl);
            }
        });

    } catch (e) {
        console.error("Firebase Init Failed:", e);
        setIsLoading(false);
        setDataSource('local');
        clearTimeout(safetyTimeout);
    }

    return () => {
        clearTimeout(safetyTimeout);
        if (unsubClasses) unsubClasses();
        if (unsubInstructors) unsubInstructors();
        if (unsubSettings) unsubSettings();
    };
  }, []);

  // --- 2. PROTECTED DATA SUBSCRIPTIONS (Users) ---
  useEffect(() => {
      let unsubUsers: () => void;

      if (currentUser.id !== 'guest') {
          try {
             unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
                 const data = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
                 setAllUsers(data);
                 saveToLocalBackup(KEYS.LOCAL_USERS, data);
             }, (error) => {
                 console.warn("Users listener failed (permission?):", error.message);
             });
          } catch(e) {
              console.error(e);
          }
      } else {
          setAllUsers([]);
      }

      return () => {
          if (unsubUsers) unsubUsers();
      };
  }, [currentUser.id]);

  const formatDateKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const getNextClassDate = (dayOfWeek: number, timeStr: string): Date => {
    const now = new Date();
    const result = new Date(now);
    const [hours, minutes] = timeStr.split(':').map(Number);
    result.setHours(hours, minutes, 0, 0);
    const currentDay = now.getDay() || 7; 
    let diffDays = dayOfWeek - currentDay;
    if (diffDays < 0) diffDays += 7;
    else if (diffDays === 0 && now.getTime() > result.getTime()) diffDays = 7;
    result.setDate(now.getDate() + diffDays);
    return result;
  };

  const validateUser = (u: string, p: string) => {
    // Legacy support only
    return null;
  };

  // --- LOGIN LOGIC (Firebase Auth) ---
  const login = async (email: string, p: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, p);
        return true;
    } catch (error: any) {
        console.error("Login Error:", error.code, error.message);
        return false;
    }
  };

  // --- GOOGLE LOGIN LOGIC ---
  const loginWithGoogle = async (): Promise<{ status: 'SUCCESS' | 'NEEDS_PHONE' | 'ERROR'; message?: string }> => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          
          // Check if user exists in Firestore
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
              // User exists, check data completeness? 
              // Assuming if doc exists, it's valid.
              return { status: 'SUCCESS' };
          } else {
              // User authenticates with Google, but no DB record.
              // They need to provide a phone number to finish registration.
              return { status: 'NEEDS_PHONE' };
          }
      } catch (error: any) {
          console.error("Google Auth Error:", error);
          return { status: 'ERROR', message: error.message };
      }
  };

  // --- REGISTER GOOGLE USER (STEP 2) ---
  const registerGoogleUser = async (phoneNumber: string): Promise<{ success: boolean; message?: string }> => {
      const user = auth.currentUser;
      if (!user) return { success: false, message: 'Google 驗證失效，請重試' };
      
      try {
          const newUser: User = {
              id: user.uid,
              name: user.displayName || 'Google User',
              email: user.email || '',
              username: user.email?.split('@')[0] || user.uid.slice(0, 8),
              role: UserRole.STUDENT,
              avatarUrl: user.photoURL || '',
              phoneNumber: phoneNumber, // Crucially added
              membershipType: 'CREDIT',
              credits: 0,
              hasPaid: false,
              mustChangePassword: false,
              unlimitedExpiry: ''
          };
          
          await setDoc(doc(db, 'users', user.uid), newUser);
          
          // Force update local state immediately since listener might have already fired with "no doc"
          setCurrentUser(newUser);
          
          return { success: true };
      } catch (e: any) {
          console.error("Register Google User Error:", e);
          return { success: false, message: e.message };
      }
  };

  const logout = async () => {
    try {
        await signOut(auth);
        setCurrentUser(GUEST_USER);
    } catch (error) {
        console.error("Logout Error:", error);
    }
  };

  // --- REGISTRATION LOGIC ---
  const registerStudent = async (userData: Partial<User>): Promise<{ success: boolean; message?: string }> => {
      const email = userData.email?.trim();
      const password = userData.password;

      if (!email || !password) return { success: false, message: '請輸入 Email 和密碼' };

      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;

          const newUser: User = {
              id: uid,
              name: userData.name || '新學生',
              email: email,
              username: email.split('@')[0], 
              role: UserRole.STUDENT,
              avatarUrl: userData.avatarUrl || '',
              phoneNumber: userData.phoneNumber || '',
              membershipType: 'CREDIT',
              credits: 0,
              hasPaid: false,
              mustChangePassword: false, 
              unlimitedExpiry: ''
          };

          await setDoc(doc(db, 'users', uid), newUser);
          return { success: true };
      } catch (error: any) {
          console.error("Registration Error:", error);
          if (error.code === 'auth/email-already-in-use') {
              return { success: false, message: '此 Email 已被註冊' };
          }
          if (error.code === 'auth/weak-password') {
              return { success: false, message: '密碼強度不足 (至少6位)' };
          }
          return { success: false, message: '註冊失敗，請檢查格式' };
      }
  };
  
  // --- ADMIN CREATE STUDENT ---
  const adminCreateStudent = async (email: string, tempPass: string, userData: Partial<User>): Promise<{ success: boolean; message?: string }> => {
      let secondaryApp;
      try {
          secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPass);
          const uid = userCredential.user.uid;
          
          const newUser: User = {
              id: uid,
              name: userData.name || '新學生',
              email: email,
              username: email.split('@')[0],
              role: UserRole.STUDENT,
              avatarUrl: userData.avatarUrl || '',
              phoneNumber: userData.phoneNumber || '',
              membershipType: 'CREDIT',
              credits: userData.credits || 0,
              hasPaid: false,
              unlimitedExpiry: userData.unlimitedExpiry || ''
          };
          
          await setDoc(doc(db, 'users', uid), newUser);
          await sendPasswordResetEmail(secondaryAuth, email);
          await signOut(secondaryAuth);
          
          return { success: true };
      } catch (error: any) {
          console.error("Admin Create Student Error:", error);
          if (error.code === 'auth/email-already-in-use') return { success: false, message: '此 Email 已被註冊' };
          return { success: false, message: error.message || '建立失敗' };
      } finally {
          if (secondaryApp) {
              await deleteApp(secondaryApp);
          }
      }
  };
  
  const notifyAdminPayment = async (lastFiveDigits: string): Promise<boolean> => {
      if (!currentUser || currentUser.role === UserRole.GUEST) return false;
      
      const BOT_TOKEN = '8388670225:AAGCEsH6-abLCLoDxaITFBHINkbsk5TciAU';
      const CHAT_ID = '6106837288';
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      
      const text = 
`💰 *匯款通知*
----------------
學生：${currentUser.name}
ID：${currentUser.id}
Email：${currentUser.email || '-'}
末五碼：${lastFiveDigits}
----------------
請管理員確認款項`;
      
      try {
          const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'Markdown' })
          });
          return response.ok;
      } catch (e) { return false; }
  };

  const checkInstructorConflict = useCallback((
      instructorId: string, 
      dayOfWeek: number, 
      startTimeStr: string, 
      durationMinutes: number, 
      excludeClassId?: string, 
      specificDate?: Date
  ): { conflict: boolean; className?: string; time?: string } => {
      
      const getMinutesFromTimeStr = (timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
      };

      const newStart = getMinutesFromTimeStr(startTimeStr);
      const newEnd = newStart + durationMinutes;
      const targetDateKey = specificDate ? formatDateKey(specificDate) : null;

      const sameDayClasses = activeClasses.filter(c => {
          if (c.id === excludeClassId) return false;
          if (Number(c.dayOfWeek) !== dayOfWeek) return false;
          return true;
      });

      for (const cls of sameDayClasses) {
          const clsStart = getMinutesFromTimeStr(cls.startTimeStr);
          const clsEnd = clsStart + cls.durationMinutes;
          const isOverlap = (newStart < clsEnd) && (newEnd > clsStart);

          if (!isOverlap) continue;

          let effectiveInstructorId = cls.instructorId; 
          if (targetDateKey) {
              if (cls.substitutions?.[targetDateKey]) {
                  effectiveInstructorId = cls.substitutions[targetDateKey];
              }
          } else {
              effectiveInstructorId = cls.instructorId;
          }

          if (effectiveInstructorId === instructorId) {
              return { conflict: true, className: cls.title, time: `${cls.startTimeStr}` };
          }
      }
      return { conflict: false };
  }, [activeClasses]);

  const bookClass = async (classId: string, userId?: string, targetDate?: Date) => {
    const targetUserId = userId || currentUser.id;
    const targetUser = allUsers.find(u => u.id === targetUserId);
    const currentClass = activeClasses.find(c => c.id === classId);
    
    if (!targetUser || !currentClass) return { success: false, message: 'User or Class not found' };
    
    const bookingDate = targetDate || getNextClassDate(currentClass.dayOfWeek, currentClass.startTimeStr);
    const bookingDateKey = formatDateKey(bookingDate);

    // OPENING CHECK: Bookings open at 9:00 AM two days before the CLASS DATE
    const openTime = new Date(bookingDate);
    openTime.setHours(9, 0, 0, 0); // 9:00 AM
    openTime.setDate(openTime.getDate() - 2); // 2 days before
    const now = new Date();
    
    if (currentUser.role === UserRole.STUDENT) {
        if (now < openTime) return { success: false, message: `尚未開放預約！` };
    }

    if (targetUser.role === UserRole.STUDENT) {
        const isAdminOverride = currentUser.role === UserRole.ADMIN;
        const membershipType = targetUser.membershipType || 'CREDIT';
        const pointsCost = currentClass.pointsCost ?? 1;

        if (membershipType === 'UNLIMITED') {
            if (!targetUser.unlimitedExpiry) {
                if (isAdminOverride) {
                    if (!window.confirm(`⚠️ 該學生為「課程自由」會員，但尚未設定到期日。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                } else { return { success: false, message: '預約失敗：您的課程自由會籍無效或已過期。' }; }
            } else {
                // FIXED LOGIC: Compare against the CLASS DATE (bookingDateKey), not Today
                if (targetUser.unlimitedExpiry < bookingDateKey) {
                    if (isAdminOverride) {
                        if (!window.confirm(`⚠️ 該學生的課程自由會籍將於 ${targetUser.unlimitedExpiry} 到期，無法涵蓋 ${bookingDateKey} 的課程。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                    } else { return { success: false, message: `預約失敗：您的會籍將於 ${targetUser.unlimitedExpiry} 到期，無法預約此課程。` }; }
                }
            }
        } else {
            const currentCredits = targetUser.credits || 0;
            if (currentCredits < pointsCost) {
                if (isAdminOverride) {
                    if (!window.confirm(`⚠️ 該學生的點數不足 (餘額: ${currentCredits}, 需扣: ${pointsCost})。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                } else { return { success: false, message: `預約失敗：點數不足！\n(餘額: ${currentCredits} 點 / 本課程需: ${pointsCost} 點)` }; }
            }
        }
    }

    const getMinutesFromTimeStr = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };
    const currentStartMins = getMinutesFromTimeStr(currentClass.startTimeStr);
    const currentEndMins = currentStartMins + currentClass.durationMinutes;
    
    const sameDayBookings = activeClasses.filter(c => {
        const usersForDate = c.bookings?.[bookingDateKey] || [];
        return usersForDate.includes(targetUserId);
    });

    const conflict = sameDayBookings.find(c => {
        if (c.id === currentClass.id) return false; 
        const cStart = getMinutesFromTimeStr(c.startTimeStr);
        const cEnd = cStart + c.durationMinutes;
        return currentStartMins < cEnd && currentEndMins > cStart;
    });

    if (conflict) {
        return { success: false, message: `⚠️ 預約失敗：時段衝突！\n\n您在 ${bookingDateKey} 已經預約了：\n「${conflict.title}」` };
    }

    try {
        const classRef = doc(db, 'classes', classId);
        const userRef = doc(db, 'users', targetUserId);

        await runTransaction(db, async (transaction) => {
            const classDoc = await transaction.get(classRef);
            let userDocPromise = null;
            if (targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
                userDocPromise = transaction.get(userRef);
            }
            if (!classDoc.exists()) throw "Class does not exist!";
            let userDoc = userDocPromise ? await userDocPromise : null;
            if (userDocPromise && !userDoc?.exists()) throw "User does not exist!";

            const freshClassData = classDoc.data();
            const freshBookingsMap = freshClassData.bookings || {};
            const freshDailyList = freshBookingsMap[bookingDateKey] || [];

            if (freshDailyList.includes(targetUserId)) return;
            if (freshDailyList.length >= freshClassData.capacity) throw "名額已滿！";

            let newBalance = -1;
            if (userDoc) {
                const freshUserData = userDoc.data();
                const currentBalance = freshUserData.credits || 0;
                const cost = currentClass.pointsCost ?? 1;
                // SAFE MATH: Prevent floating point errors (e.g. 1.2 - 0.4 = 0.799999)
                newBalance = safeSubtract(currentBalance, cost);
                
                if (newBalance < 0) throw "點數不足";
            }

            transaction.update(classRef, { [`bookings.${bookingDateKey}`]: [...freshDailyList, targetUserId] });
            if (userDoc && newBalance >= 0) transaction.update(userRef, { credits: newBalance });
        });
        return { success: true };
    } catch (error) {
        console.error("Transaction Error:", error);
        return { success: false, message: typeof error === 'string' ? error : '預約失敗，請重試。' };
    }
  };

  const cancelClass = async (classId: string, userId?: string, targetDate?: Date) => {
    const targetUserId = userId || currentUser.id;
    const targetUser = allUsers.find(u => u.id === targetUserId);
    const currentClass = activeClasses.find(c => c.id === classId); 
    
    if (!currentClass || !targetDate) return; 
    const bookingDateKey = formatDateKey(targetDate);

    if (currentUser.role === UserRole.STUDENT) {
        const now = new Date();
        const [h, m] = currentClass.startTimeStr.split(':').map(Number);
        const classStartTime = new Date(targetDate);
        classStartTime.setHours(h, m, 0, 0);
        if (now > classStartTime) {
            alert("❌ 無法取消：課程已結束。");
            return;
        }
    }
    
    try {
        const classRef = doc(db, 'classes', classId);
        const userRef = doc(db, 'users', targetUserId);

        await runTransaction(db, async (transaction) => {
            const classDoc = await transaction.get(classRef);
            let userDocPromise = null;
            if (targetUser && targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
                userDocPromise = transaction.get(userRef);
            }
            if (!classDoc.exists()) return;
            let userDoc = userDocPromise ? await userDocPromise : null;
            
            const freshClassData = classDoc.data();
            const freshBookingsMap = freshClassData.bookings || {};
            const freshDailyList = freshBookingsMap[bookingDateKey] || [];

            if (!freshDailyList.includes(targetUserId)) return; 

            let newBalance = -1;
            if (userDoc && userDoc.exists()) {
                const freshUserData = userDoc.data();
                const currentBalance = freshUserData.credits || 0;
                const cost = currentClass.pointsCost ?? 1;
                // SAFE MATH ADDITION
                newBalance = Math.round((currentBalance + cost) * 100) / 100;
            }

            transaction.update(classRef, { [`bookings.${bookingDateKey}`]: freshDailyList.filter((id: string) => id !== targetUserId) });
            if (userDoc && newBalance >= 0) transaction.update(userRef, { credits: newBalance });
        });
    } catch (error) { console.error("Cancel Error:", error); }
  };

  const addClass = async (classData: any) => {
    const existingClassIds = [...activeClasses, ...archivedClasses].map(c => c.id);
    const newId = generateSequentialId('class', existingClassIds);
    const newClass = {
        ...classData,
        id: newId,
        title: classData.title || '新課程',
        description: classData.description || '', 
        dayOfWeek: Number(classData.dayOfWeek) || 1,
        startTimeStr: classData.startTimeStr || '10:00',
        durationMinutes: Number(classData.durationMinutes) || 60,
        capacity: Number(classData.capacity) || 20,
        pointsCost: Number(classData.pointsCost) ?? 1, 
        bookings: {},
        enrolledUserIds: [],
        createdAt: formatDateKey(new Date()),
        archived: false,
        substitutions: {}
    };
    try { await setDoc(doc(db, 'classes', newId), newClass); } catch (e) { console.error(e); }
  };

  const updateClass = async (id: string, updates: any) => {
      const currentClass = activeClasses.find(c => c.id === id);
      if (!currentClass) return;
      
      const isBaseInstructorChange = updates.instructorId && updates.instructorId !== currentClass.instructorId;

      if (isBaseInstructorChange) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          await updateDoc(doc(db, 'classes', id), { archived: true, archivedAt: formatDateKey(yesterday) });

          const existingClassIds = [...activeClasses, ...archivedClasses].map(c => c.id);
          const newId = generateSequentialId('class', existingClassIds);
          
          const newClass = {
              ...currentClass,
              ...updates,
              id: newId,
              createdAt: formatDateKey(new Date()),
              archived: false,
              archivedAt: null,
              bookings: {}, 
              enrolledUserIds: [],
              substitutions: {}
          };
          await setDoc(doc(db, 'classes', newId), newClass);
      } else {
          await updateDoc(doc(db, 'classes', id), updates);
      }
  };

  const deleteClass = async (id: string) => {
      await updateDoc(doc(db, 'classes', id), { archived: true, archivedAt: formatDateKey(new Date()) });
  };

  const deleteClassWithRefund = async (classId: string) => {
    try {
        await runTransaction(db, async (transaction) => {
            const classRef = doc(db, 'classes', classId);
            const classDoc = await transaction.get(classRef);
            if (!classDoc.exists()) throw "Class not found";
            
            const classData = classDoc.data();
            const bookings = classData.bookings || {};
            const pointsCost = classData.pointsCost ?? 1;
            const todayStr = formatDateKey(new Date());
            const refundMap = new Map<string, number>(); 
            
            Object.entries(bookings).forEach(([dateKey, userIds]: [string, any]) => {
                if (dateKey >= todayStr) {
                    (userIds as string[]).forEach(uid => {
                        const current = refundMap.get(uid) || 0;
                        refundMap.set(uid, current + pointsCost);
                    });
                }
            });
            
            if (refundMap.size === 0) {
                transaction.update(classRef, { archived: true, archivedAt: todayStr });
                return;
            }

            const userIds = Array.from(refundMap.keys());
            const userRefs = userIds.map(uid => doc(db, 'users', uid));
            const userDocs = await Promise.all(userRefs.map(ref => transaction.get(ref)));
            
            userDocs.forEach((uDoc, index) => {
                if (uDoc.exists()) {
                    const userData = uDoc.data();
                    if ((userData.membershipType || 'CREDIT') === 'CREDIT') {
                        // Safe Math for Refunds
                        const currentCredits = userData.credits || 0;
                        const refundAmount = refundMap.get(userIds[index]) || 0;
                        const newTotal = Math.round((currentCredits + refundAmount) * 100) / 100;
                        
                        transaction.update(userRefs[index], { credits: newTotal });
                    }
                }
            });
            transaction.update(classRef, { archived: true, archivedAt: todayStr });
        });
    } catch (e) { throw e; }
  };

  const updateClassInstructor = async (classId: string, newInstructorId: string, notification?: string, targetDate?: Date) => {
      if (!targetDate) await updateClass(classId, { instructorId: newInstructorId });
  };

  const addInstructor = (data: Partial<Instructor>) => {
      const existingInstIds = instructors.map(i => i.id);
      const id = generateSequentialId('instructor', existingInstIds);
      const newInst = {
          id,
          name: data.name || 'New Instructor',
          bio: data.bio || '',
          imageUrl: data.imageUrl || '',
          defaultRate: data.defaultRate || 800,
          ...data
      };
      try { setDoc(doc(db, 'instructors', id), newInst); } catch(e) {}
      return id;
  };
  
  const updateInstructor = (id: string, updates: any) => { try { updateDoc(doc(db, 'instructors', id), updates); } catch(e) {} };
  const deleteInstructor = (id: string) => { try { deleteDoc(doc(db, 'instructors', id)); } catch(e) {} };
  
  // Admin adds student (Creates a Firestore Doc WITHOUT Auth for "Ghost" students)
  const addStudent = (d: any) => {
      const targetUsername = d.username || `user${Date.now()}`;
      const existingUserIds = allUsers.map(u => u.id);
      const id = generateSequentialId('student', existingUserIds);

      const newS = { 
          id, 
          role: UserRole.STUDENT, 
          avatarUrl: d.avatarUrl || '', 
          hasPaid: false, 
          membershipType: d.membershipType || 'CREDIT',
          credits: d.credits || 0,
          unlimitedExpiry: d.unlimitedExpiry || '',
          username: targetUsername,
          name: d.name || '新學生',
          phoneNumber: d.phoneNumber || '',
          email: d.email || '' // Store email if provided
      };
      
      try { setDoc(doc(db, 'users', id), newS); } catch(e) { console.error("Add Student Error:", e); return ""; }
      return id;
  };

  const updateStudent = async (id: string, u: any) => { try { await updateDoc(doc(db, 'users', id), u); } catch(e) { throw e; } };
  const updateUser = async (id: string, u: any) => { try { await updateDoc(doc(db, 'users', id), u); } catch(e) { throw e; } };
  
  const updateAppLogo = async (base64Image: string) => {
      try {
          setAppLogo(base64Image);
          localStorage.setItem(KEYS.LOCAL_LOGO, base64Image);
          await setDoc(doc(db, 'settings', 'global'), { logoUrl: base64Image }, { merge: true });
      } catch(e) { console.error(e); }
  };

  const updateAppBackgroundImage = async (base64Image: string) => {
      try {
          setAppBackgroundImage(base64Image);
          localStorage.setItem(KEYS.LOCAL_BG, base64Image);
          await setDoc(doc(db, 'settings', 'global'), { backgroundImageUrl: base64Image }, { merge: true });
      } catch(e) { console.error(e); }
  };

  // --- DELETE STUDENT (FRONTEND ONLY) ---
  const deleteStudent = async (id: string): Promise<{ success: boolean; message?: string }> => {
      const targetStudent = allUsers.find(u => u.id === id);
      
      // We can only delete the Firestore document from the client
      try {
          await deleteDoc(doc(db, 'users', id));
          
          let msg = '';
          if (targetStudent?.email) {
              msg = `已刪除學生資料庫檔案。\n\n(⚠️ 注意：因無後端支援，Firebase Auth 登入帳號 (${targetStudent.email}) 仍存在，需至 Firebase Console 手動刪除以免佔用 Email)`;
          } else {
              msg = '已成功刪除學生資料。';
          }
          
          return { success: true, message: msg };
      } catch (e: any) {
          console.error("Firestore deletion failed:", e);
          return { success: false, message: '資料庫刪除失敗，請檢查權限或網路' };
      }
  };
  
  const resetStudentPassword = async (id: string) => {
        const student = allUsers.find(u => u.id === id);
        if (!student) return;
        
        if (!student.email) {
             alert("錯誤：該學生資料未包含 Email，無法重置密碼。\n請先編輯學生資料填入 Email。");
             return;
        }

        try {
            await sendPasswordResetEmail(auth, student.email);
            alert(`✅ 已發送重置信件！\n\n系統已發送密碼重置連結至：${student.email}\n請通知學生查收信件並設定新密碼。`);
        } catch (error: any) {
            console.error("Password Reset Error", error);
            if (error.code === 'auth/user-not-found') {
                alert("⚠️ 發送失敗：該 Email 尚未註冊帳號。\n\n此學生可能僅有資料庫建檔，尚未完成 App 帳號註冊。");
            } else if (error.code === 'auth/invalid-email') {
                alert("⚠️ 發送失敗：Email 格式不正確。");
            } else {
                alert("❌ 發送失敗：" + error.message);
            }
        }
  };

  return (
    <AppContext.Provider value={{
      currentUser, classes: activeClasses, allClassesHistory, instructors, students, appLogo, appBackgroundImage,
      login, logout, validateUser, isLoginModalOpen, setLoginModalOpen, registerStudent,
      bookClass, cancelClass, addClass, updateClass, deleteClass, deleteClassWithRefund,
      updateClassInstructor, addInstructor, updateInstructor, deleteInstructor,
      addStudent, updateStudent, updateUser, deleteStudent, resetStudentPassword, updateAppLogo, updateAppBackgroundImage,
      getNextClassDate, formatDateKey, checkInstructorConflict, isLoading, dataSource,
      fetchArchivedClasses, pruneArchivedClasses, notifyAdminPayment, adminCreateStudent,
      loginWithGoogle, registerGoogleUser
    }}>
      {children}
    </AppContext.Provider>
  );
};
