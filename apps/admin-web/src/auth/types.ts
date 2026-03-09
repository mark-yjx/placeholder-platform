export type AdminUser = {
  email: string;
  role: 'admin';
};

export type LoginResponse = {
  token: string;
  user: AdminUser;
};
