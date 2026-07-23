import { UserRole } from '../../users/entities/user.entity';

/** Formato de `request.user`, populado pelo SessionGuard a partir da sessão validada. */
export interface AuthUser {
  id: string;
  login: string;
  role: UserRole;
  clientName: string | null;
  moduleWhatsapp: boolean;
  moduleTelefonia: boolean;
  mustChangePassword: boolean;
}
