
export enum UserRole {
  GUEST = 'GUEST',
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export type MembershipType = 'CREDIT' | 'UNLIMITED';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl: string;
  email?: string; // Changed from implied username to explicit email
  username?: string; // Kept for display handle (e.g. @john)
  password?: string; // Optional now as Auth handles it, but kept for legacy/admin created users
  phoneNumber?: string; 
  
  membershipType?: MembershipType; 
  credits?: number; 
  unlimitedExpiry?: string; 
  
  hasPaid?: boolean; 
  mustChangePassword?: boolean;
}

export interface Instructor {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
  phoneNumber?: string; // Added phone number
  defaultRate?: number; 
}

export interface ClassSession {
  id: string;
  title: string;
  description?: string; 
  dayOfWeek: number; 
  startTimeStr: string; 
  durationMinutes: number;
  instructorId: string; 
  capacity: number;
  location: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  
  pointsCost?: number; 

  isSubstitute: boolean;
  originalInstructorId?: string;
  substitutionDate?: string; 
  notificationMessage?: string; 
  enrolledUserIds: string[]; 
  
  bookings?: Record<string, string[]>;
  substitutions?: Record<string, string>; 

  createdAt?: string; 
  archived?: boolean;
  archivedAt?: string; 
}

export interface AppState {
  currentUser: User;
  classes: ClassSession[]; 
  allClassesHistory: ClassSession[]; 
  instructors: Instructor[];
  students: User[]; 
  appLogo: string | null; 
  appBackgroundImage: string | null;
}

export interface AppContextType extends AppState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  validateUser: (username: string, password: string) => User | null; // Kept for legacy compatibility
  isLoginModalOpen: boolean;
  setLoginModalOpen: (isOpen: boolean) => void;
  
  registerStudent: (userData: Partial<User>) => Promise<{ success: boolean; message?: string }>;
  adminCreateStudent: (email: string, tempPass: string, userData: Partial<User>) => Promise<{ success: boolean; message?: string }>;

  bookClass: (classId: string, userId?: string, targetDate?: Date) => Promise<{ success: boolean; message?: string }>;
  cancelClass: (classId: string, userId?: string, targetDate?: Date) => Promise<void>;
  
  addClass: (classData: Omit<ClassSession, 'id' | 'enrolledUserIds' | 'isSubstitute'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<ClassSession>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  deleteClassWithRefund: (classId: string) => Promise<void>;

  updateClassInstructor: (classId: string, newInstructorId: string, notification?: string, targetDate?: Date) => void;
  addInstructor: (data: Partial<Instructor>) => string;
  updateInstructor: (id: string, updates: Partial<Instructor>) => void;
  deleteInstructor: (id: string) => void;
  
  addStudent: (student: Partial<User>) => string;
  updateStudent: (id: string, updates: Partial<User>) => void;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteStudent: (id: string) => Promise<{ success: boolean; message?: string }>;
  resetStudentPassword: (id: string) => Promise<void>; 
  
  updateAppLogo: (base64Image: string) => Promise<void>;
  updateAppBackgroundImage: (base64Image: string) => Promise<void>;

  getNextClassDate: (dayOfWeek: number, timeStr: string) => Date;
  formatDateKey: (date: Date) => string;
  checkInstructorConflict: (instructorId: string, dayOfWeek: number, startTimeStr: string, durationMinutes: number, excludeClassId?: string, specificDate?: Date) => { conflict: boolean; className?: string; time?: string };
  
  fetchArchivedClasses: () => Promise<void>;
  pruneArchivedClasses: (monthsToKeep: number) => Promise<{ deletedDocs: number; cleanedRecords: number }>;
  
  notifyAdminPayment: (lastFiveDigits: string) => Promise<boolean>;

  isLoading: boolean;
  dataSource: 'firebase' | 'local'; 
}
