import { api } from './client.js';

export const cartApi = {
  get:    ()          => api.get('/cart', true),
  add:    (product_id) => api.post('/cart', { product_id, quantity: 1 }, true),
  remove: (product_id) => api.delete(`/cart/${product_id}`, true),
  clear:  ()          => api.delete('/cart', true),
};
