import { api } from './client.js';

export const orderApi = {
  create:         (coupon_code)    => api.post('/orders', { coupon_code }, true),
  list:           (page = 1)       => api.get(`/orders?page=${page}`, true),
  detail:         (id)             => api.get(`/orders/${id}`, true),
  validateCoupon: (code, amount)   => api.post('/orders/validate-coupon', { code, order_amount: amount }, true),
  createPayment:  (order_id, bank_code) => {
    const q = bank_code ? `?bank_code=${bank_code}` : '';
    return api.post(`/payment/create/${order_id}${q}`, null, true);
  },
  paymentStatus:  (order_id)       => api.get(`/payment/status/${order_id}`, true),
  myCourses:      ()               => api.get('/learning/my-courses', true),
  courseContent:  (product_id)     => api.get(`/learning/course/${product_id}`, true),
  ebookContent:   (product_id)     => api.get(`/learning/ebook/${product_id}`, true),
  updateProgress: (lesson_id, watched_seconds, completed) =>
    api.post(`/learning/progress/${lesson_id}?watched_seconds=${watched_seconds}&completed=${completed}`, null, true),
};
