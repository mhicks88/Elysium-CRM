// packages/shared-types/src/dto/auth.ts

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
}

export interface LoginResponseDto {
  token: string;
  user: AuthUserDto;
}

