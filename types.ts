
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
  username?: string; 
  password?: string; 
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
}

export interface AppContextType extends AppState {
  login: (username: string, password: string) => boolean;
  logout: () => void;
  validateUser: (username: string, password: string) => User | null; 
  isLoginModalOpen: boolean;
  setLoginModalOpen: (isOpen: boolean) => void;

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
  deleteStudent: (id: string) => void;
  resetStudentPassword: (id: string) => Promise<void>; 
  
  updateAppLogo: (base64Image: string) => Promise<void>;

  getNextClassDate: (dayOfWeek: number, timeStr: string) => Date;
  formatDateKey: (date: Date) => string;
  checkInstructorConflict: (instructorId: string, dayOfWeek: number, startTimeStr: string, durationMinutes: number, excludeClassId?: string, specificDate?: Date) => { conflict: boolean; className?: string; time?: string };
  
  fetchArchivedClasses: () => Promise<void>;
  pruneArchivedClasses: (monthsToKeep: number) => Promise<{ deletedDocs: number; cleanedRecords: number }>;

  isLoading: boolean;
  dataSource: 'firebase' | 'local'; 
}