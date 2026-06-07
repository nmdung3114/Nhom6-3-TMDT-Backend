#!/usr/bin/env python3
"""Patch loadCoupons in admin-page.js to fix colspan and field names."""
import re

FILE = 'frontend/js/pages/admin-page.js'
content = open(FILE, 'r', encoding='utf-8').read()

# Find and replace the loadCoupons function
old_pattern = r'// ─+ Coupons ─+\nasync function loadCoupons\(\) \{.*?\}\n'
new_fn = r'''// ── Coupons ────────────────────────────────────────────────
async function loadCoupons() {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get('/admin/coupons', true);
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-text-muted)">Chua co ma giam gia nao. Nhan \"+ Tao ma moi\" de bat dau.</td></tr>';
      return;
    }
    const now = new Date();
    tbody.innerHTML = data.map(c => {
      const isExpired = c.expired_date && new Date(c.expired_date) < now;
      const isActive  = c.is_active !== false && !isExpired;
      const usagePct  = c.usage_limit ? Math.round((c.used_count / c.usage_limit) * 100) : null;
      const usageText = c.usage_limit
        ? `${c.used_count}&nbsp;/&nbsp;${c.usage_limit} <small style="color:${usagePct > 80 ? 'var(--color-error)' : 'var(--color-text-muted)'}">(${usagePct}%)</small>`
        : `${c.used_count}&nbsp;/&nbsp;<span style="color:var(--color-text-muted)">inf</span>`;
      const statusBadge = isActive
        ? '<span class="badge badge-success">Active</span>'
        : isExpired ? '<span class="badge badge-error">Het han</span>'
          : '<span class="badge badge-warning">Tam dung</span>';
      const expiredText = c.expired_date
        ? `<div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:2px">HH: ${new Date(c.expired_date).toLocaleDateString('vi-VN')}</div>`
        : '';
      const safeCode = c.code.replace(/'/g, "\\'");
      return `
        <tr>
          <td><code style="background:var(--color-bg-tertiary);padding:5px 12px;border-radius:6px;font-weight:800;color:var(--color-accent);border:1px solid var(--color-border-accent)">${c.code}</code></td>
          <td style="font-weight:700;color:${c.discount_type === 'percent' ? 'var(--color-warning)' : 'var(--color-success)'}">${c.discount_type === 'percent' ? '-' + c.discount + '%' : formatPrice(c.discount)}</td>
          <td><span class="badge ${c.discount_type === 'percent' ? 'badge-accent' : 'badge-success'}">${c.discount_type === 'percent' ? '% Phan tram' : 'Co dinh'}</span></td>
          <td>${c.min_order_amount > 0 ? formatPrice(c.min_order_amount) : '--'}</td>
          <td>${usageText}</td>
          <td>${statusBadge}${expiredText}</td>
          <td><button class="btn btn-sm btn-danger" onclick="deleteCoupon('${safeCode}')">X Xoa</button></td>
        </tr>`;
    }).join('');
  } catch(e) {
    console.error('Coupon load error:', e);
    document.getElementById('coupons-tbody').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-error)">Loi tai du lieu: ${e.message}</td></tr>`;
    showToast('Loi tai danh sach coupon: ' + e.message, 'error');
  }
}
'''

result = re.sub(old_pattern, new_fn, content, flags=re.DOTALL)
if result == content:
    print("WARNING: Pattern not matched, trying line-based replacement...")
    # Line-based: find the function and replace it
    lines = content.split('\n')
    start_idx = None
    end_idx = None
    for i, line in enumerate(lines):
        if 'Coupons' in line and '\u2500' in line:
            start_idx = i
        if start_idx is not None and i > start_idx and line.startswith('}') and end_idx is None:
            # Check if next line is blank or window.deleteCoupon
            if i + 1 < len(lines) and ('deleteCoupon' in lines[i+1] or lines[i+1].strip() == ''):
                end_idx = i
                break
    
    if start_idx is not None and end_idx is not None:
        print(f"Found function at lines {start_idx+1}-{end_idx+1}")
        print("First line:", lines[start_idx])
        print("Last line:", lines[end_idx])
    else:
        print("Could not find function boundaries")
        # Just find 'loadCoupons' occurrences
        for i, line in enumerate(lines):
            if 'loadCoupons' in line or 'Coupons' in line:
                print(f"Line {i+1}: {line[:80]}")
else:
    print("Replacement successful!")
    open(FILE, 'w', encoding='utf-8').write(result)
