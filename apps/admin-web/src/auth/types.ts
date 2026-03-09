export type AdminUser = {
  email: string;
  userId?: string | null;
  role: 'admin';
};

export type LoginResponse = {
  token: string;
  user: AdminUser;
};
