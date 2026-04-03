import { api } from './client.js';

export const authApi = {
  login:          (email, password)           => api.post('/auth/login', { email, password }),
  register:       (name, email, password, phone) => api.post('/auth/register', { name, email, password, phone }),
  oauthCallback:  (data)                      => api.post('/auth/oauth/callback', data),
  me:             ()                          => api.get('/auth/me', true),
  changePassword: (current_password, new_password) => api.post('/users/change-password', { current_password, new_password }, true),
  updateProfile:  (data)                      => api.put('/users/profile', data, true),
};
