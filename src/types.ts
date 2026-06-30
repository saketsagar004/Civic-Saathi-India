export type UserRole = "citizen" | "officer" | "worker" | "pending_officer" | "pending_worker" | "super_admin";
export type Department = "Public Works" | "Municipal Corporation" | "Jal Board" | "Electricity" | "Law & Enforcement" | "Other" | string;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  status?: 'active' | 'suspended';
  department?: Department;
  employeeId?: string;
  idProofUrl?: string;
  roleRejected?: boolean;
  approvedByAdmin?: boolean;
  appliedAt?: number;
}

export interface DepartmentInfo {
  departmentName: string;
  departmentShortName: string;
  city: string;
  contactEmail: string | null;
  contactPhone: string | null;
  officialWebsite: string | null;
  note: string;
}

export interface Notification {
  id: string;
  uid: string;
  title: string;
  message: string;
  issueId?: string;
  timestamp: number;
  read: boolean;
  type: string;
}

export interface CivicIssueReport {
  id?: string;
  userId: string;
  imageUrl: string;
  category: string;
  severity: string;
  description: string;
  department: Department;
  
  // Geocoded location details
  location: {
    lat: number;
    lng: number;
  };
  address?: string;
  city?: string;
  district?: string;
  state?: string;

  // Dynamic Department Info from AI
  departmentInfo?: DepartmentInfo;

  // Workflow assignments
  assignedOfficerUid?: string;
  assignedOfficerName?: string;
  assignedWorkerUid?: string;
  assignedWorkerName?: string;

  // Resolution Details
  resolutionImageUrl?: string;
  resolutionVerdict?: {
    isResolved: boolean;
    isAIGenerated: boolean;
    resolutionConfidence: number;
    locationReasonable: boolean;
    reason: string;
  };

  // Feedback
  feedback?: {
    stars: number;
    comment: string;
    suggestion: string;
    timestamp: number;
  };

  timestamp: number;
  status: "Reported" | "Verified" | "Assigned" | "In Progress" | "Pending Verification" | "Resolved" | "Closed";
  upvoteCount: number;
  upvotedBy: string[]; // User IDs who have upvoted
  
  // Timeline timestamps
  verifiedAt?: number;
  assignedAt?: number;
  inProgressAt?: number;
  pendingVerificationAt?: number;
  resolvedAt?: number;
  closedAt?: number;
}
