export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">

        <!-- Brand Column -->
        <div>
          <div class="footer__brand">
            <div class="footer__brand-icon">🎓</div>
            <span class="footer__brand-name">ELearnVN</span>
          </div>
          <p class="footer__desc">
            Nền tảng học trực tuyến hàng đầu Việt Nam — nơi bạn học kỹ năng thực chiến
            từ những chuyên gia dày dặn kinh nghiệm, học lúc nào, ở đâu cũng được.
          </p>
          <div class="footer__social">
            <a href="#" class="footer__social-link" title="Facebook" aria-label="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
            </a>
            <a href="#" class="footer__social-link" title="YouTube" aria-label="YouTube">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 001.95-1.97A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
            </a>
            <a href="#" class="footer__social-link" title="GitHub" aria-label="GitHub">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
            </a>
            <a href="#" class="footer__social-link" title="LinkedIn" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>

          <div class="footer__newsletter">
            <div class="footer__newsletter-title">📬 Đăng ký nhận thông tin mới nhất</div>
            <div class="footer__newsletter-form">
              <input type="email" class="footer__newsletter-input" placeholder="Email của bạn...">
              <button class="footer__newsletter-btn">Đăng ký</button>
            </div>
          </div>
        </div>

        <!-- Courses -->
        <div>
          <div class="footer__col-title">Khóa học</div>
          <div class="footer__links">
            <a href="/products/list.html?type=course" class="footer__link">→ Lập trình Web</a>
            <a href="/products/list.html?type=course" class="footer__link">→ Data Science</a>
            <a href="/products/list.html?type=course" class="footer__link">→ Mobile Dev</a>
            <a href="/products/list.html?type=course" class="footer__link">→ UI/UX Design</a>
            <a href="/products/list.html?type=course" class="footer__link">→ DevOps & Cloud</a>
          </div>
        </div>

        <!-- Ebook -->
        <div>
          <div class="footer__col-title">Ebook</div>
          <div class="footer__links">
            <a href="/products/list.html?type=ebook" class="footer__link">→ Lập trình</a>
            <a href="/products/list.html?type=ebook" class="footer__link">→ AI & Machine Learning</a>
            <a href="/products/list.html?type=ebook" class="footer__link">→ Business</a>
            <a href="/products/list.html?type=ebook" class="footer__link">→ Marketing</a>
            <a href="/products/list.html?type=ebook" class="footer__link">→ Tài chính cá nhân</a>
          </div>
        </div>

        <!-- Support -->
        <div>
          <div class="footer__col-title">Hỗ trợ</div>
          <div class="footer__links">
            <a href="#" class="footer__link">→ Trung tâm hỗ trợ</a>
            <a href="#" class="footer__link">→ Điều khoản dịch vụ</a>
            <a href="#" class="footer__link">→ Chính sách bảo mật</a>
            <a href="#" class="footer__link">→ Hoàn tiền</a>
            <a href="#" class="footer__link">→ Liên hệ chúng tôi</a>
          </div>
        </div>

      </div>

      <div class="footer__bottom">
        <div class="footer__copy">© ${new Date().getFullYear()} ELearnVN. All rights reserved.</div>
        <div class="footer__badges">
          <span class="footer__badge">VNPay</span>
          <span class="footer__badge">SSL Secured</span>
          <span class="footer__badge">Made in 🇻🇳</span>
        </div>
      </div>
    </div>`;
}
