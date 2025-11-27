import { UserRole } from '../enums';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
