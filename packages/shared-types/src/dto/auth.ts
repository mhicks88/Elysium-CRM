import { UserRole } from '../enums';

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface LoginResponseDto {
  token: string;
  user: AuthUserDto;
}
