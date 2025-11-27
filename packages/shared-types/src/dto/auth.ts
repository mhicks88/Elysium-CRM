import { UserRole } from '../enums';

export interface LoginRequestDto {
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface LoginResponseDto {
  token: string;
  user: AuthUserDto;
export interface LoginResponse {
  token: string;
  user: AuthUser;
}
