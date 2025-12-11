
import React, { createContext, useContext, useState, useEffect, PropsWithChildren, useCallback } from 'react';
import { AppState, ClassSession, Instructor, User, UserRole, AppContextType } from '../types';
import { db } from '../firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
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
  LOCAL_USERS: 'zenflow_local_users_backup'
};

const GUEST_USER: User = {
    id: 'guest',
    name: '訪客',
    role: UserRole.GUEST,
    avatarUrl: 'https://ui-avatars.com/api/?name=Guest&background=eee&color=999',
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

export const AppProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  
  const [activeClasses, setActiveClasses] = useState<ClassSession[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<ClassSession[]>([]);
  const [hasFetchedArchived, setHasFetchedArchived] = useState(false);

  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'firebase' | 'local'>('firebase');

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  
  const allClassesHistory = [...activeClasses, ...archivedClasses];

  // Robust safeStringify
  const saveToLocalBackup = (key: string, data: any) => {
    const safeStringify = (obj: any) => {
        const cache = new Set();
        try {
            return JSON.stringify(obj, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    // Avoid DOM nodes or Window objects which can cause circular ref errors
                    try {
                        if (value.window === value) return;
                        if (value instanceof HTMLElement) return;
                    } catch (e) {
                        return;
                    }
                    
                    if (cache.has(value)) {
                        return;
                    }
                    cache.add(value);
                }
                return value;
            });
        } catch (e) {
            console.warn(`[Backup Skipped] Failed to serialize ${key}`, e);
            return "[]";
        }
    };
    try { localStorage.setItem(key, safeStringify(data)); } catch (e) { console.error(e); }
  };
  
  const loadFromLocalBackup = <T,>(key: string): T[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  };

  const fetchArchivedClasses = async () => {
      if (hasFetchedArchived) return; 
      
      try {
          console.log("Fetching archived classes from Firestore...");
          const q = query(collection(db, 'classes'), where('archived', '==', true));
          const snapshot = await getDocs(q);
          const data: ClassSession[] = snapshot.docs.map(doc => ({
              ...(doc.data() as Omit<ClassSession, 'id'>),
              id: doc.id
          }));
          setArchivedClasses(data);
          setHasFetchedArchived(true);
          console.log(`Loaded ${data.length} archived classes.`);
      } catch (e) {
          console.error("Error fetching archived classes:", e);
      }
  };

  // DEEP CLEAN PRUNE FUNCTION
  const pruneArchivedClasses = async (monthsToKeep: number): Promise<{ deletedDocs: number; cleanedRecords: number }> => {
      if (!hasFetchedArchived) {
          await fetchArchivedClasses();
      }

      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - monthsToKeep);
      const thresholdStr = formatDateKey(thresholdDate);

      console.log(`Pruning data older than ${thresholdStr}...`);
      let deletedDocs = 0;
      let cleanedRecords = 0;

      // 1. DELETE OLD ARCHIVED DOCUMENTS
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
              chunk.forEach(c => {
                  batch.delete(doc(db, 'classes', c.id));
              });
              await batch.commit();
              deletedDocs += chunk.length;
          }

          // 2. DEEP CLEAN ACTIVE CLASSES (Remove old bookings)
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
                          cleanedRecords += count; // Count removed bookings
                          changed = true;
                      }
                  });
              }

              if (c.substitutions) {
                  Object.keys(c.substitutions).forEach(dateKey => {
                      if (dateKey < thresholdStr) {
                          delete newSubstitutions[dateKey];
                          cleanedRecords++; // Count removed subs
                          changed = true;
                      }
                  });
              }

              if (changed) {
                  currentBatch.update(doc(db, 'classes', c.id), {
                      bookings: newBookings,
                      substitutions: newSubstitutions
                  });
                  activeOps++;

                  if (activeOps >= 400) {
                      await currentBatch.commit();
                      currentBatch = writeBatch(db);
                      activeOps = 0;
                  }
              }
          }

          if (activeOps > 0) {
              await currentBatch.commit();
          }

          // Update local state
          const deletedIds = new Set(toDelete.map(c => c.id));
          setArchivedClasses(prev => prev.filter(c => !deletedIds.has(c.id)));
          
          return { deletedDocs, cleanedRecords };
      } catch (e) {
          console.error("Prune Error:", e);
          throw e;
      }
  };

  useEffect(() => {
    let unsubClasses: () => void;
    let unsubInstructors: () => void;
    let unsubUsers: () => void;
    let unsubSettings: () => void;

    try {
        const activeClassesQuery = query(collection(db, 'classes'), where('archived', '==', false));

        unsubClasses = onSnapshot(activeClassesQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            const data: ClassSession[] = snapshot.docs.map(doc => {
                const docData = doc.data();
                // Ensure data is JSON safe before state
                return {
                    ...(docData as Omit<ClassSession, 'id'>),
                    id: doc.id
                };
            });
            setActiveClasses(data);
            setDataSource('firebase');
            saveToLocalBackup(KEYS.LOCAL_CLASSES, data);
        }, (error) => console.error("Firestore Classes Error:", error));

        unsubInstructors = onSnapshot(collection(db, 'instructors'), (snapshot: QuerySnapshot<DocumentData>) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
            setInstructors(data);
            saveToLocalBackup(KEYS.LOCAL_INSTRUCTORS, data);
        }, (error) => console.error(error));

        unsubUsers = onSnapshot(collection(db, 'users'), (snapshot: QuerySnapshot<DocumentData>) => {
             const data = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
             setAllUsers(data);
             saveToLocalBackup(KEYS.LOCAL_USERS, data);
             setIsLoading(false);
        }, (error) => { console.error(error); setIsLoading(false); });
        
        unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.logoUrl) setAppLogo(data.logoUrl);
            }
        });

    } catch (e) {
        console.error("Firebase Init Failed:", e);
        setActiveClasses(loadFromLocalBackup(KEYS.LOCAL_CLASSES));
        setInstructors(loadFromLocalBackup(KEYS.LOCAL_INSTRUCTORS));
        setAllUsers(loadFromLocalBackup(KEYS.LOCAL_USERS));
        setIsLoading(false);
        setDataSource('local');
    }

    return () => {
        if (unsubClasses) unsubClasses();
        if (unsubInstructors) unsubInstructors();
        if (unsubUsers) unsubUsers();
        if (unsubSettings) unsubSettings();
    };
  }, []);

  const formatDateKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // --- SEEDING & CLEANUP LOGIC ---
  useEffect(() => {
    const maintainAdminAccount = async () => {
        if (isLoading) return;

        const admins = allUsers.filter(u => u.username === 'admin');
        
        if (admins.length === 0) {
             const adminId = 'default_admin';
             const newAdmin = { 
                 id: adminId, 
                 name: '教室經理', 
                 role: UserRole.ADMIN, 
                 avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=333&color=fff', 
                 username: 'admin', 
                 password: 'ooxx1234'
             };
             try { await setDoc(doc(db, 'users', adminId), newAdmin); } catch(e) {}
             return;
        }

        let masterAdmin = admins.find(u => u.id === 'default_admin');
        if (!masterAdmin) {
            masterAdmin = admins[0]; 
        }

        for (const admin of admins) {
            if (admin.id !== masterAdmin.id) {
                try { await deleteDoc(doc(db, 'users', admin.id)); } catch(e) {}
            }
        }

        if (masterAdmin) {
            const dirtyFields: any = {};
            if (masterAdmin.credits !== undefined) dirtyFields.credits = deleteField();
            if (masterAdmin.membershipType !== undefined) dirtyFields.membershipType = deleteField();
            if (masterAdmin.unlimitedExpiry !== undefined) dirtyFields.unlimitedExpiry = deleteField();
            if (masterAdmin.hasPaid !== undefined) dirtyFields.hasPaid = deleteField();

            if (Object.keys(dirtyFields).length > 0) {
                try { await updateDoc(doc(db, 'users', masterAdmin.id), dirtyFields); } catch(e) {}
            }
        }
    };
    
    maintainAdminAccount();
  }, [isLoading, allUsers.length]);

  useEffect(() => {
    const storedId = localStorage.getItem(KEYS.CURRENT_USER_ID);
    if (storedId && allUsers.length > 0) {
        const foundUser = allUsers.find(u => u.id === storedId);
        if (foundUser) setCurrentUser(foundUser);
    }
  }, [allUsers]);

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
    const trimmedUsername = u.trim();
    const user = allUsers.find(user => user.username === trimmedUsername && user.password === p);
    return user || null;
  };

  const login = (u: string, p: string) => {
    const user = validateUser(u, p);
    if (user) {
        setCurrentUser(user);
        localStorage.setItem(KEYS.CURRENT_USER_ID, user.id);
        return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(GUEST_USER);
    localStorage.removeItem(KEYS.CURRENT_USER_ID);
  };

  const getMinutesFromTimeStr = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
  };

  const checkInstructorConflict = useCallback((
      instructorId: string, 
      dayOfWeek: number, 
      startTimeStr: string, 
      durationMinutes: number, 
      excludeClassId?: string, 
      specificDate?: Date
  ): { conflict: boolean; className?: string; time?: string } => {
      
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
              return { 
                  conflict: true, 
                  className: cls.title, 
                  time: `${cls.startTimeStr}`
              };
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
    
    // Only applies to STUDENTS
    if (currentUser.role === UserRole.STUDENT) {
        if (now < openTime) {
             return { success: false, message: `尚未開放預約！` };
        }
    }

    if (targetUser.role === UserRole.STUDENT) {
        const isAdminOverride = currentUser.role === UserRole.ADMIN;
        const membershipType = targetUser.membershipType || 'CREDIT';
        const pointsCost = currentClass.pointsCost ?? 1;

        if (membershipType === 'UNLIMITED') {
            if (!targetUser.unlimitedExpiry) {
                if (isAdminOverride) {
                    if (!window.confirm(`⚠️ 該學生為「課程自由」會員，但尚未設定到期日。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                } else {
                    return { success: false, message: '預約失敗：您的課程自由會籍無效或已過期。' };
                }
            } else {
                const todayStr = formatDateKey(new Date());
                if (targetUser.unlimitedExpiry < todayStr) {
                    if (isAdminOverride) {
                        if (!window.confirm(`⚠️ 該學生的課程自由會籍已於 ${targetUser.unlimitedExpiry} 過期。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                    } else {
                        return { success: false, message: `預約失敗：您的會籍已於 ${targetUser.unlimitedExpiry} 到期。` };
                    }
                }
            }
        } else {
            const currentCredits = targetUser.credits || 0;
            if (currentCredits < pointsCost) {
                if (isAdminOverride) {
                    if (!window.confirm(`⚠️ 該學生的點數不足 (餘額: ${currentCredits}, 需扣: ${pointsCost})。\n\n確定要幫他預約嗎？`)) return { success: false, message: 'Cancelled' };
                } else {
                    return { success: false, message: `預約失敗：點數不足！\n(餘額: ${currentCredits} 點 / 本課程需: ${pointsCost} 點)` };
                }
            }
        }
    }

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
        return { 
            success: false, 
            message: `⚠️ 預約失敗：時段衝突！\n\n您在 ${bookingDateKey} 已經預約了：\n「${conflict.title}」\n時間：${conflict.startTimeStr}` 
        };
    }

    // Optimistic Update
    const originalBookings = currentClass.bookings || {};
    const originalDailyList = originalBookings[bookingDateKey] || [];
    
    if (!originalDailyList.includes(targetUserId)) {
        const optimisticClasses = activeClasses.map(c => {
            if (c.id === classId) {
                const newBookings = { ...c.bookings };
                newBookings[bookingDateKey] = [...(newBookings[bookingDateKey] || []), targetUserId];
                return { ...c, bookings: newBookings };
            }
            return c;
        });
        setActiveClasses(optimisticClasses);

        if (targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
             const newBalance = (targetUser.credits || 0) - (currentClass.pointsCost ?? 1);
             const optimisticUsers = allUsers.map(u => u.id === targetUserId ? { ...u, credits: newBalance } : u);
             setAllUsers(optimisticUsers);
        }
    }

    try {
        const classRef = doc(db, 'classes', classId);
        const userRef = doc(db, 'users', targetUserId);

        await runTransaction(db, async (transaction) => {
            const classDocPromise = transaction.get(classRef);
            let userDocPromise = null;

            const isCreditUser = targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT';
            if (isCreditUser) {
                userDocPromise = transaction.get(userRef);
            }

            const classDoc = await classDocPromise;
            if (!classDoc.exists()) throw "Class does not exist!";

            let userDoc = null;
            if (userDocPromise) {
                userDoc = await userDocPromise;
                if (!userDoc.exists()) throw "User does not exist!";
            }

            const freshClassData = classDoc.data();
            const freshBookingsMap = freshClassData.bookings || {};
            const freshDailyList = freshBookingsMap[bookingDateKey] || [];

            if (freshDailyList.includes(targetUserId)) {
                return;
            }

            if (freshDailyList.length >= freshClassData.capacity) {
                throw "名額已滿！請稍後再試。"; 
            }

            let newBalance = -1;
            if (userDoc) {
                const freshUserData = userDoc.data();
                newBalance = (freshUserData.credits || 0) - (currentClass.pointsCost ?? 1);
                if (newBalance < 0) throw "點數不足";
            }

            const updatedDailyList = [...freshDailyList, targetUserId];
            transaction.update(classRef, {
                [`bookings.${bookingDateKey}`]: updatedDailyList
            });

            if (userDoc && newBalance >= 0) {
                transaction.update(userRef, { credits: newBalance });
            }
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
            alert("❌ 無法取消：課程已結束。\n\n已結束的課程無法自行取消或退還點數。");
            return;
        }
    }
    
    // Optimistic Update
    const originalBookings = currentClass.bookings || {};
    const originalDailyList = originalBookings[bookingDateKey] || [];

    if (originalDailyList.includes(targetUserId)) {
        const optimisticClasses = activeClasses.map(c => {
            if (c.id === classId) {
                const newBookings = { ...c.bookings };
                const list = newBookings[bookingDateKey] || [];
                newBookings[bookingDateKey] = list.filter(id => id !== targetUserId);
                return { ...c, bookings: newBookings };
            }
            return c;
        });
        setActiveClasses(optimisticClasses);

        if (targetUser && targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT') {
             const newBalance = (targetUser.credits || 0) + (currentClass.pointsCost ?? 1);
             const optimisticUsers = allUsers.map(u => u.id === targetUserId ? { ...u, credits: newBalance } : u);
             setAllUsers(optimisticUsers);
        }
    }

    try {
        const classRef = doc(db, 'classes', classId);
        const userRef = doc(db, 'users', targetUserId);

        await runTransaction(db, async (transaction) => {
            const classDocPromise = transaction.get(classRef);
            let userDocPromise = null;

            const isCreditUser = targetUser && targetUser.role === UserRole.STUDENT && (targetUser.membershipType || 'CREDIT') === 'CREDIT';
            if (isCreditUser) {
                userDocPromise = transaction.get(userRef);
            }

            const classDoc = await classDocPromise;
            if (!classDoc.exists()) return;

            let userDoc = null;
            if (userDocPromise) {
                userDoc = await userDocPromise;
            }
            
            const freshClassData = classDoc.data();
            const freshBookingsMap = freshClassData.bookings || {};
            const freshDailyList = freshBookingsMap[bookingDateKey] || [];

            if (!freshDailyList.includes(targetUserId)) return; 

            let newBalance = -1;
            if (userDoc && userDoc.exists()) {
                const freshUserData = userDoc.data();
                newBalance = (freshUserData.credits || 0) + (currentClass.pointsCost ?? 1);
            }

            const updatedDailyList = freshDailyList.filter((id: string) => id !== targetUserId);
            transaction.update(classRef, {
                [`bookings.${bookingDateKey}`]: updatedDailyList
            });

            if (userDoc && newBalance >= 0) {
                transaction.update(userRef, { credits: newBalance });
            }
        });
    } catch (error) {
        console.error("Cancel Error:", error);
    }
  };

  const addClass = async (classData: any) => {
    // Generate new ID: class1, class2, class3... and fill gaps
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
          const yesterdayStr = formatDateKey(yesterday);
          
          await updateDoc(doc(db, 'classes', id), { 
              archived: true, 
              archivedAt: yesterdayStr 
          });

          const todayStr = formatDateKey(new Date());
          
          // Generate new ID for the new active class instance
          const existingClassIds = [...activeClasses, ...archivedClasses].map(c => c.id);
          const newId = generateSequentialId('class', existingClassIds);
          
          const newClass = {
              id: newId,
              title: updates.title || currentClass.title,
              description: updates.description !== undefined ? updates.description : (currentClass.description || ''),
              dayOfWeek: updates.dayOfWeek || currentClass.dayOfWeek,
              startTimeStr: updates.startTimeStr || currentClass.startTimeStr,
              durationMinutes: updates.durationMinutes || currentClass.durationMinutes,
              instructorId: updates.instructorId || currentClass.instructorId,
              capacity: updates.capacity || currentClass.capacity,
              location: updates.location || currentClass.location,
              difficulty: updates.difficulty || currentClass.difficulty,
              pointsCost: updates.pointsCost ?? currentClass.pointsCost ?? 1,
              createdAt: todayStr,
              archived: false,
              archivedAt: null,
              bookings: {}, 
              enrolledUserIds: [],
              substitutions: {},
              isSubstitute: false
          };

          await setDoc(doc(db, 'classes', newId), newClass);
      } else {
          await updateDoc(doc(db, 'classes', id), updates);
      }
  };

  const deleteClass = async (id: string) => {
      const todayStr = formatDateKey(new Date());
      await updateDoc(doc(db, 'classes', id), { archived: true, archivedAt: todayStr });
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
                        const currentCredits = userData.credits || 0;
                        const refundAmount = refundMap.get(userIds[index]) || 0;
                        transaction.update(userRefs[index], { credits: currentCredits + refundAmount });
                    }
                }
            });
            
            transaction.update(classRef, { archived: true, archivedAt: todayStr });
        });
    } catch (e) {
        console.error("Delete Refund Error", e);
        throw e;
    }
  };

  const updateClassInstructor = async (classId: string, newInstructorId: string, notification?: string, targetDate?: Date) => {
      if (!targetDate) {
          await updateClass(classId, { instructorId: newInstructorId });
      }
  };

  const addInstructor = (data: Partial<Instructor>) => {
      // Generate new ID: instructor1, instructor2... and fill gaps
      const existingInstIds = instructors.map(i => i.id);
      const id = generateSequentialId('instructor', existingInstIds);

      const newInst = {
          id,
          name: data.name || 'New Instructor',
          bio: data.bio || '',
          imageUrl: data.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'I')}&background=random`,
          defaultRate: data.defaultRate || 800,
          ...data
      };
      try { setDoc(doc(db, 'instructors', id), newInst); } catch(e) {}
      return id;
  };
  
  const updateInstructor = (id: string, updates: any) => { try { updateDoc(doc(db, 'instructors', id), updates); } catch(e) {} };
  const deleteInstructor = (id: string) => { try { deleteDoc(doc(db, 'instructors', id)); } catch(e) {} };
  
  const addStudent = (d: any) => {
      const targetUsername = d.username || `user${Date.now()}`;
      const isDuplicate = allUsers.some(u => u.username?.toLowerCase() === targetUsername.toLowerCase());
      if (isDuplicate) {
          alert(`❌ 新增失敗：帳號 ID "${targetUsername}" 已存在！\n請使用其他帳號。`);
          return ""; 
      }

      // Generate Sequential ID: student1, student2... and fill gaps
      // We check ALL users to ensure ID uniqueness across the collection
      const existingUserIds = allUsers.map(u => u.id);
      const id = generateSequentialId('student', existingUserIds);

      if (!d.role) d.role = UserRole.STUDENT;
      // Use explicit ID here
      const newS = { 
          id, 
          role: UserRole.STUDENT, 
          avatarUrl: d.avatarUrl || `https://ui-avatars.com/api/?name=${d.name || 'User'}&background=random`, 
          password: '123456', 
          hasPaid: false, 
          mustChangePassword: true, 
          membershipType: d.membershipType || 'CREDIT',
          credits: d.credits || 0,
          unlimitedExpiry: d.unlimitedExpiry || '',
          username: targetUsername,
          ...d
      };
      
      try { setDoc(doc(db, 'users', id), newS); } catch(e) { console.error("Add Student Error:", e); alert("新增學生失敗，請檢查資料。"); return ""; }
      return id;
  };

  const updateStudent = (id: string, u: any) => { 
      if (u.username) {
          const isDuplicate = allUsers.some(user => user.id !== id && user.username?.toLowerCase() === u.username.toLowerCase());
          if (isDuplicate) {
              alert(`❌ 更新失敗：帳號 ID "${u.username}" 已被使用。`);
              return;
          }
      }
      try { updateDoc(doc(db, 'users', id), u); } catch(e) {} 
  };

  const updateUser = async (id: string, u: any) => { 
      if (u.username) {
          const isDuplicate = allUsers.some(user => user.id !== id && user.username?.toLowerCase() === u.username.toLowerCase());
          if (isDuplicate) {
              alert(`❌ 更新失敗：帳號 ID "${u.username}" 已被使用。`);
              throw new Error("Duplicate username");
          }
      }
      try { await updateDoc(doc(db, 'users', id), u); } catch(e) { throw e; } 
  };
  
  const updateAppLogo = async (base64Image: string) => {
      try {
          await setDoc(doc(db, 'settings', 'global'), { logoUrl: base64Image }, { merge: true });
      } catch(e) {
          console.error("Update Logo Error:", e);
      }
  };

  const deleteStudent = (id: string) => { try { deleteDoc(doc(db, 'users', id)); } catch(e) {} };
  
  const resetStudentPassword = async (id: string) => {
      try {
          await updateDoc(doc(db, 'users', id), {
              password: '123456',
              mustChangePassword: true
          });
      } catch (e) {
          console.error("Reset Password Error:", e);
          throw e;
      }
  };

  return (
    <AppContext.Provider value={{
      currentUser, classes: activeClasses, allClassesHistory, instructors, students, appLogo,
      login, logout, validateUser, isLoginModalOpen, setLoginModalOpen,
      bookClass, cancelClass, addClass, updateClass, deleteClass, deleteClassWithRefund,
      updateClassInstructor, addInstructor, updateInstructor, deleteInstructor,
      addStudent, updateStudent, updateUser, deleteStudent, resetStudentPassword, updateAppLogo,
      getNextClassDate, formatDateKey, checkInstructorConflict, isLoading, dataSource,
      fetchArchivedClasses, pruneArchivedClasses
    }}>
      {children}
    </AppContext.Provider>
  );
};
