
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
  getAuth
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
  runTransaction,
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
  LOCAL_BG: 'zenflow_local_bg',
  LOCAL_ICON_192: 'zenflow_local_icon_192',
  LOCAL_ICON_512: 'zenflow_local_icon_512'
};

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

const generateSequentialId = (prefix: string, existingIds: string[]): string => {
    const idSet = new Set(existingIds);
    let num = 1;
    while (idSet.has(`${prefix}${num}`)) { num++; }
    return `${prefix}${num}`;
};

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
  
  const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem(KEYS.LOCAL_LOGO));
  const [appBackgroundImage, setAppBackgroundImage] = useState<string | null>(() => localStorage.getItem(KEYS.LOCAL_BG));
  const [appIcon192, setAppIcon192] = useState<string | null>(() => localStorage.getItem(KEYS.LOCAL_ICON_192));
  const [appIcon512, setAppIcon512] = useState<string | null>(() => localStorage.getItem(KEYS.LOCAL_ICON_512));

  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'firebase' | 'local'>('firebase');

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const allClassesHistory = [...activeClasses, ...archivedClasses];

  const saveToLocalBackup = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error(e); }
  };
  
  const loadFromLocalBackup = <T,>(key: string): T[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  };

  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
              try {
                  const userDocRef = doc(db, 'users', firebaseUser.uid);
                  const userDoc = await getDoc(userDocRef);
                  if (userDoc.exists()) {
                      const userData = userDoc.data() as User;
                      setCurrentUser({ ...userData, id: firebaseUser.uid }); 
                  } else {
                      setCurrentUser(GUEST_USER);
                  }
              } catch (e) { console.error("Error fetching user profile:", e); }
          } else {
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
          const data: ClassSession[] = snapshot.docs.map(doc => ({ ...(doc.data() as Omit<ClassSession, 'id'>), id: doc.id }));
          setArchivedClasses(data);
          setHasFetchedArchived(true);
      } catch (e) { console.error("Error fetching archived classes:", e); }
  };

  const pruneArchivedClasses = async (monthsToKeep: number): Promise<{ deletedDocs: number; cleanedRecords: number }> => {
      if (!hasFetchedArchived) await fetchArchivedClasses();
      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - monthsToKeep);
      const thresholdStr = formatDateKey(thresholdDate);
      let deletedDocs = 0;
      let cleanedRecords = 0;
      const toDelete = archivedClasses.filter(c => {
          const dateRef = c.archivedAt || c.createdAt;
          return dateRef && dateRef < thresholdStr;
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
                          cleanedRecords += newBookings[dateKey].length;
                          delete newBookings[dateKey];
                          changed = true;
                      }
                  });
              }
              if (c.substitutions) {
                  Object.keys(c.substitutions).forEach(dateKey => {
                      if (dateKey < thresholdStr) { delete newSubstitutions[dateKey]; changed = true; }
                  });
              }
              if (changed) {
                  currentBatch.update(doc(db, 'classes', c.id), { bookings: newBookings, substitutions: newSubstitutions });
                  activeOps++;
                  if (activeOps >= 400) { await currentBatch.commit(); currentBatch = writeBatch(db); activeOps = 0; }
              }
          }
          if (activeOps > 0) await currentBatch.commit();
          return { deletedDocs, cleanedRecords };
      } catch (e) { throw e; }
  };
  
  const cleanupInactiveStudents = async (): Promise<{ count: number }> => {
      const todayStr = formatDateKey(new Date());
      const studentsWithFutureBookings = new Set<string>();
      activeClasses.forEach(c => {
          if (c.bookings) {
              Object.entries(c.bookings).forEach(([dateKey, userIds]) => {
                  if (dateKey >= todayStr) { (userIds as string[]).forEach(id => studentsWithFutureBookings.add(id)); }
              });
          }
      });
      const targets = allUsers.filter(u => {
          if (u.role !== UserRole.STUDENT) return false;
          if (studentsWithFutureBookings.has(u.id)) return false;
          if ((u.credits || 0) > 0) return false;
          const isUnlimited = u.membershipType === 'UNLIMITED';
          if (isUnlimited && (u.unlimitedExpiry && u.unlimitedExpiry >= todayStr)) return false;
          return true; 
      });
      if (targets.length === 0) return { count: 0 };
      const batchLimit = 400;
      let currentBatch = writeBatch(db);
      let count = 0;
      for (const u of targets) {
          currentBatch.delete(doc(db, 'users', u.id));
          count++;
          if (count >= batchLimit) { await currentBatch.commit(); currentBatch = writeBatch(db); count = 0; }
      }
      if (count > 0) await currentBatch.commit();
      return { count: targets.length };
  };

  useEffect(() => {
    let unsubClasses: () => void;
    let unsubInstructors: () => void;
    let unsubSettings: () => void;
    const safetyTimeout = setTimeout(() => {
        setIsLoading(prev => {
            if (prev) {
                setDataSource('local');
                setActiveClasses(loadFromLocalBackup(KEYS.LOCAL_CLASSES));
                setInstructors(loadFromLocalBackup(KEYS.LOCAL_INSTRUCTORS));
                setAllUsers(loadFromLocalBackup(KEYS.LOCAL_USERS));
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
                if (data.logoUrl) { setAppLogo(data.logoUrl); localStorage.setItem(KEYS.LOCAL_LOGO, data.logoUrl); }
                if (data.backgroundImageUrl) { setAppBackgroundImage(data.backgroundImageUrl); localStorage.setItem(KEYS.LOCAL_BG, data.backgroundImageUrl); }
                if (data.appIcon192) { setAppIcon192(data.appIcon192); localStorage.setItem(KEYS.LOCAL_ICON_192, data.appIcon192); }
                if (data.appIcon512) { setAppIcon512(data.appIcon512); localStorage.setItem(KEYS.LOCAL_ICON_512, data.appIcon512); }
            }
        });
    } catch (e) { setIsLoading(false); setDataSource('local'); clearTimeout(safetyTimeout); }
    return () => { clearTimeout(safetyTimeout); if (unsubClasses) unsubClasses(); if (unsubInstructors) unsubInstructors(); if (unsubSettings) unsubSettings(); };
  }, []);

  useEffect(() => {
      let unsubUsers: () => void;
      if (currentUser.id !== 'guest') {
          unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
              const data = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
              setAllUsers(data);
              saveToLocalBackup(KEYS.LOCAL_USERS, data);
          }, (e) => console.warn(e));
      } else { setAllUsers([]); }
      return () => { if (unsubUsers) unsubUsers(); };
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

  const login = async (email: string, p: string): Promise<boolean> => {
    try { await signInWithEmailAndPassword(auth, email, p); return true; } catch (e) { return false; }
  };

  const loginWithGoogle = async (): Promise<{ status: 'SUCCESS' | 'NEEDS_PHONE' | 'ERROR'; message?: string }> => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          return docSnap.exists() ? { status: 'SUCCESS' } : { status: 'NEEDS_PHONE' };
      } catch (e: any) { return { status: 'ERROR', message: e.message }; }
  };

  const registerGoogleUser = async (phoneNumber: string): Promise<{ success: boolean; message?: string }> => {
      const user = auth.currentUser;
      if (!user) return { success: false, message: 'Google 驗證失效' };
      try {
          const newUser: User = { id: user.uid, name: user.displayName || 'Google User', email: user.email || '', username: user.email?.split('@')[0] || user.uid.slice(0, 8), role: UserRole.STUDENT, avatarUrl: user.photoURL || '', phoneNumber, membershipType: 'CREDIT', credits: 0, hasPaid: false, unlimitedExpiry: '' };
          await setDoc(doc(db, 'users', user.uid), newUser);
          setCurrentUser(newUser);
          return { success: true };
      } catch (e: any) { return { success: false, message: e.message }; }
  };

  const logout = async () => { try { await signOut(auth); setCurrentUser(GUEST_USER); } catch (e) { console.error(e); } };

  const registerStudent = async (userData: Partial<User>): Promise<{ success: boolean; message?: string }> => {
      const email = userData.email?.trim();
      const password = userData.password;
      if (!email || !password) return { success: false, message: '資料不全' };
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;
          const newUser: User = { id: uid, name: userData.name || '新學生', email, username: email.split('@')[0], role: UserRole.STUDENT, avatarUrl: userData.avatarUrl || '', phoneNumber: userData.phoneNumber || '', membershipType: 'CREDIT', credits: 0, hasPaid: false, unlimitedExpiry: '' };
          await setDoc(doc(db, 'users', uid), newUser);
          return { success: true };
      } catch (e: any) { return { success: false, message: e.message }; }
  };
  
  const adminCreateStudent = async (email: string, tempPass: string, userData: Partial<User>): Promise<{ success: boolean; message?: string }> => {
      let secondaryApp;
      try {
          secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPass);
          const uid = userCredential.user.uid;
          const newUser: User = { id: uid, name: userData.name || '新學生', email, username: email.split('@')[0], role: UserRole.STUDENT, avatarUrl: userData.avatarUrl || '', phoneNumber: userData.phoneNumber || '', membershipType: 'CREDIT', credits: userData.credits || 0, hasPaid: false, unlimitedExpiry: userData.unlimitedExpiry || '' };
          await setDoc(doc(db, 'users', uid), newUser);
          await sendPasswordResetEmail(secondaryAuth, email);
          return { success: true };
      } catch (e: any) { return { success: false, message: e.message }; } 
      finally { if (secondaryApp) await deleteApp(secondaryApp); }
  };
  
  const notifyAdminPayment = async (lastFiveDigits: string): Promise<boolean> => {
      const text = `💰 匯款通知\n學生：${currentUser.name}\n末五碼：${lastFiveDigits}`;
      try {
          const res = await fetch(`https://api.telegram.org/bot8388670225:AAGCEsH6-abLCLoDxaITFBHINkbsk5TciAU/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: '6106837288', text, parse_mode: 'Markdown' })
          });
          return res.ok;
      } catch (e) { return false; }
  };

  const checkInstructorConflict = useCallback((instructorId: string, dayOfWeek: number, startTimeStr: string, durationMinutes: number, excludeClassId?: string, specificDate?: Date): { conflict: boolean; className?: string; time?: string } => {
      const getMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
      const newStart = getMin(startTimeStr);
      const newEnd = newStart + durationMinutes;
      const dateKey = specificDate ? formatDateKey(specificDate) : null;
      for (const cls of activeClasses.filter(c => c.id !== excludeClassId && Number(c.dayOfWeek) === dayOfWeek)) {
          const clsStart = getMin(cls.startTimeStr);
          const clsEnd = clsStart + cls.durationMinutes;
          if (newStart < clsEnd && newEnd > clsStart) {
              const effectiveId = dateKey && cls.substitutions?.[dateKey] ? cls.substitutions[dateKey] : cls.instructorId;
              if (effectiveId === instructorId) return { conflict: true, className: cls.title, time: cls.startTimeStr };
          }
      }
      return { conflict: false };
  }, [activeClasses]);

  const bookClass = async (classId: string, userId?: string, targetDate?: Date) => {
    const targetUserId = userId || currentUser.id;
    const targetUser = allUsers.find(u => u.id === targetUserId);
    const cls = activeClasses.find(c => c.id === classId);
    if (!targetUser || !cls) return { success: false, message: 'Not found' };
    const bookingDate = targetDate || getNextClassDate(cls.dayOfWeek, cls.startTimeStr);
    const bookingDateKey = formatDateKey(bookingDate);
    if (currentUser.role === UserRole.STUDENT) {
        const openTime = new Date(bookingDate); openTime.setHours(9,0,0,0); openTime.setDate(openTime.getDate()-2);
        if (new Date() < openTime) return { success: false, message: '尚未開放預約' };
    }
    try {
        await runTransaction(db, async (transaction) => {
            const classDoc = await transaction.get(doc(db, 'classes', classId));
            const freshClass = classDoc.data();
            const dailyList = freshClass?.bookings?.[bookingDateKey] || [];
            if (dailyList.includes(targetUserId)) return;
            if (dailyList.length >= (freshClass?.capacity || 20)) throw "名額已滿";
            if (targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
                const newBal = safeSubtract(targetUser.credits || 0, cls.pointsCost ?? 1);
                if (newBal < 0) throw "點數不足";
                transaction.update(doc(db, 'users', targetUserId), { credits: newBal });
            }
            transaction.update(doc(db, 'classes', classId), { [`bookings.${bookingDateKey}`]: [...dailyList, targetUserId] });
        });
        return { success: true };
    } catch (e: any) { return { success: false, message: typeof e === 'string' ? e : '預約失敗' }; }
  };

  const cancelClass = async (classId: string, userId?: string, targetDate?: Date) => {
    const targetUserId = userId || currentUser.id;
    const targetUser = allUsers.find(u => u.id === targetUserId);
    const cls = activeClasses.find(c => c.id === classId); 
    if (!cls || !targetDate) return; 
    const dateKey = formatDateKey(targetDate);
    try {
        await runTransaction(db, async (transaction) => {
            const classDoc = await transaction.get(doc(db, 'classes', classId));
            const dailyList = classDoc.data()?.bookings?.[dateKey] || [];
            if (!dailyList.includes(targetUserId)) return;
            if (targetUser && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
                transaction.update(doc(db, 'users', targetUserId), { credits: Math.round(((targetUser.credits || 0) + (cls.pointsCost ?? 1))*100)/100 });
            }
            transaction.update(doc(db, 'classes', classId), { [`bookings.${dateKey}`]: dailyList.filter((id: string) => id !== targetUserId) });
        });
    } catch (e) { console.error(e); }
  };

  const addClass = async (d: any) => {
    const id = generateSequentialId('class', allClassesHistory.map(c => c.id));
    await setDoc(doc(db, 'classes', id), { ...d, id, bookings: {}, enrolledUserIds: [], createdAt: formatDateKey(new Date()), archived: false, substitutions: {} });
  };

  const updateClass = async (id: string, updates: any) => {
      const cls = activeClasses.find(c => c.id === id);
      if (!cls) return;
      if (updates.instructorId && updates.instructorId !== cls.instructorId) {
          const y = new Date(); y.setDate(y.getDate()-1);
          await updateDoc(doc(db, 'classes', id), { archived: true, archivedAt: formatDateKey(y) });
          const newId = generateSequentialId('class', allClassesHistory.map(c => c.id));
          await setDoc(doc(db, 'classes', newId), { ...cls, ...updates, id: newId, createdAt: formatDateKey(new Date()), archived: false, archivedAt: null, bookings: {}, substitutions: {} });
      } else { await updateDoc(doc(db, 'classes', id), updates); }
  };

  const deleteClass = async (id: string) => { await updateDoc(doc(db, 'classes', id), { archived: true, archivedAt: formatDateKey(new Date()) }); };
  const updateClassInstructor = async (classId: string, newId: string, n?: string, td?: Date) => { if (!td) await updateClass(classId, { instructorId: newId }); };
  const addInstructor = (d: any) => {
      const id = generateSequentialId('instructor', instructors.map(i => i.id));
      setDoc(doc(db, 'instructors', id), { id, name: d.name || 'New', bio: d.bio || '', imageUrl: d.imageUrl || '', defaultRate: d.defaultRate || 800, ...d });
      return id;
  };
  const updateInstructor = (id: string, u: any) => updateDoc(doc(db, 'instructors', id), u);
  const deleteInstructor = (id: string) => deleteDoc(doc(db, 'instructors', id));
  const addStudent = (d: any) => {
      const id = generateSequentialId('student', allUsers.map(u => u.id));
      setDoc(doc(db, 'users', id), { id, role: UserRole.STUDENT, avatarUrl: d.avatarUrl || '', hasPaid: false, membershipType: d.membershipType || 'CREDIT', credits: d.credits || 0, unlimitedExpiry: d.unlimitedExpiry || '', username: d.username || `user${Date.now()}`, name: d.name || '新學生', phoneNumber: d.phoneNumber || '', email: d.email || '' });
      return id;
  };
  const updateStudent = async (id: string, u: any) => updateDoc(doc(db, 'users', id), u);
  const updateUser = async (id: string, u: any) => updateDoc(doc(db, 'users', id), u);
  const updateAppLogo = async (url: string) => { setAppLogo(url); localStorage.setItem(KEYS.LOCAL_LOGO, url); await setDoc(doc(db, 'settings', 'global'), { logoUrl: url }, { merge: true }); };
  const updateAppBackgroundImage = async (url: string) => { setAppBackgroundImage(url); localStorage.setItem(KEYS.LOCAL_BG, url); await setDoc(doc(db, 'settings', 'global'), { backgroundImageUrl: url }, { merge: true }); };
  
  const updateAppIcons = async (icon192: string, icon512: string) => {
      setAppIcon192(icon192); setAppIcon512(icon512);
      localStorage.setItem(KEYS.LOCAL_ICON_192, icon192); localStorage.setItem(KEYS.LOCAL_ICON_512, icon512);
      await setDoc(doc(db, 'settings', 'global'), { appIcon192, appIcon512 }, { merge: true });
  };

  const deleteStudent = async (id: string) => { try { await deleteDoc(doc(db, 'users', id)); return { success: true, message: '已刪除學生資料庫檔案' }; } catch(e) { return { success: false }; } };
  const resetStudentPassword = async (id: string) => { const s = allUsers.find(u => u.id === id); if (s?.email) await sendPasswordResetEmail(auth, s.email); };

  return (
    <AppContext.Provider value={{
      currentUser, classes: activeClasses, allClassesHistory, instructors, students, appLogo, appBackgroundImage, appIcon192, appIcon512,
      login, logout, validateUser: () => null, isLoginModalOpen, setLoginModalOpen, registerStudent,
      bookClass, cancelClass, addClass, updateClass, deleteClass, deleteClassWithRefund: async () => {},
      updateClassInstructor, addInstructor, updateInstructor, deleteInstructor,
      addStudent, updateStudent, updateUser, deleteStudent, resetStudentPassword, updateAppLogo, updateAppBackgroundImage, updateAppIcons,
      getNextClassDate, formatDateKey, checkInstructorConflict, isLoading, dataSource,
      fetchArchivedClasses, pruneArchivedClasses, cleanupInactiveStudents, notifyAdminPayment, adminCreateStudent,
      loginWithGoogle, registerGoogleUser
    }}>
      {children}
    </AppContext.Provider>
  );
};
