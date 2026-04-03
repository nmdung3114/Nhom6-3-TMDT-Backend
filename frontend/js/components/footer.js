export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">
            <div class="footer__brand-icon">🎓</div>
            <span class="footer__brand-name">ELearnVN</span>
          </div>
          <p class="footer__desc">Nền tảng học trực tuyến hàng đầu Việt Nam, cung cấp khóa học chất lượng cao từ các chuyên gia thực chiến.</p>
          <div class="footer__social">
            <a href="#" class="footer__social-link" title="Facebook">f</a>
            <a href="#" class="footer__social-link" title="YouTube">▶</a>
            <a href="#" class="footer__social-link" title="Twitter">𝕏</a>
          </div>
        </div>
        <div>
          <div class="footer__col-title">Khóa học</div>
          <div class="footer__links">
            <a href="/products/list.html?type=course" class="footer__link">Lập trình Web</a>
            <a href="/products/list.html?type=course" class="footer__link">Data Science</a>
            <a href="/products/list.html?type=course" class="footer__link">Mobile Dev</a>
            <a href="/products/list.html?type=course" class="footer__link">UI/UX Design</a>
          </div>
        </div>
        <div>
          <div class="footer__col-title">Ebook</div>
          <div class="footer__links">
            <a href="/products/list.html?type=ebook" class="footer__link">Lập trình</a>
            <a href="/products/list.html?type=ebook" class="footer__link">AI & Machine Learning</a>
            <a href="/products/list.html?type=ebook" class="footer__link">Business</a>
            <a href="/products/list.html?type=ebook" class="footer__link">Marketing</a>
          </div>
        </div>
        <div>
          <div class="footer__col-title">Hỗ trợ</div>
          <div class="footer__links">
            <a href="#" class="footer__link">Trung tâm hỗ trợ</a>
            <a href="#" class="footer__link">Điều khoản dịch vụ</a>
            <a href="#" class="footer__link">Chính sách bảo mật</a>
            <a href="#" class="footer__link">Liên hệ</a>
          </div>
        </div>
      </div>
      <div class="footer__bottom">
        <div class="footer__copy">© ${new Date().getFullYear()} ELearnVN. All rights reserved.</div>
        <div style="font-size:0.8rem;color:var(--color-text-muted)">Made with ❤️ in Vietnam</div>
      </div>
    </div>`;
}
