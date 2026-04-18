/* ================================================================
   danhgia.js — Đánh giá / Reviews page
   ================================================================ */
function _apiHost() { var h = window.location.hostname; return (h === 'localhost' || h === '127.0.0.1') ? 'localhost' : h; }

// ─── State ───────────────────────────────────────────────────────
var REVIEWS    = [];
var _dgFilter   = 'all';
var _dgPageSize = 4;
var _dgHienTai  = 4;
var _dgLiked    = {};  // track liked reviews

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    dgCapNhatBadge();
    dgFetchReviews();
});

// ─── Fetch Reviews from API ──────────────────────────────────────
function dgFetchReviews() {
    var container = document.getElementById('dg-review-list');
    if (container) {
        container.innerHTML =
            '<div class="text-center py-5">' +
                '<i class="fa-solid fa-spinner fa-spin fa-2x text-muted"></i>' +
                '<p class="text-muted mt-2">Đang tải đánh giá...</p>' +
            '</div>';
    }

    var token = localStorage.getItem('accessToken');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(`http://${_apiHost()}:8080/api/reviews`, { headers: headers })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (json) {
            var items = [];
            if (Array.isArray(json)) {
                items = json;
            } else if (json && Array.isArray(json.data)) {
                items = json.data;
            } else if (json && json.data && Array.isArray(json.data.content)) {
                items = json.data.content;
            }

            REVIEWS = items.map(function (r) {
                return {
                    id:     r.id,
                    name:   (r.user && (r.user.fullName || r.user.username)) || r.userName || 'Khách hàng',
                    avatar: (r.user && r.user.avatar) || r.userAvatar || 'https://i.pravatar.cc/100?u=' + r.id,
                    rating: r.rating  || r.star || 5,
                    time:   dgFormatTime(r.createdAt || r.reviewDate),
                    food:   (r.menuItem && r.menuItem.name) || r.menuItemName || '',
                    text:   r.comment || r.content || r.text || '',
                    images: r.images  || r.reviewImages || [],
                    likes:  r.likeCount || r.likes || 0
                };
            });

            dgCapNhatSummary();
_dgHienTai = _dgPageSize;
            dgRender();
        })
        .catch(function (err) {
            console.error('Lỗi tải đánh giá:', err);
            REVIEWS = [];
            dgCapNhatSummary();
            dgRender();
        });
}

// ─── Format time helper ──────────────────────────────────────────
function dgFormatTime(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        var now = new Date();
        var diff = Math.floor((now - d) / 1000);
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước';
        return d.toLocaleDateString('vi-VN');
    } catch (e) { return dateStr; }
}

// ─── Summary Stats ───────────────────────────────────────────────
function dgCapNhatSummary() {
    var total = REVIEWS.length;

    // Khi không có dữ liệu → reset về 0
    if (total === 0) {
        var scoreEl = document.getElementById('dg-avg-score');
        if (scoreEl) scoreEl.textContent = '0';
        var starsEl = document.getElementById('dg-avg-stars');
        if (starsEl) starsEl.innerHTML = dgRenderStars(0);
        var totalEl = document.getElementById('dg-total-text');
        if (totalEl) totalEl.innerHTML = 'Chưa có đánh giá nào';
        for (var s = 5; s >= 1; s--) {
            var bar = document.getElementById('bar-' + s);
            var pctEl = document.getElementById('pct-' + s);
            if (bar) bar.style.width = '0%';
            if (pctEl) pctEl.textContent = '0%';
        }
        return;
    }

    // Count per star
    var counts = {5:0, 4:0, 3:0, 2:0, 1:0};
    var sum = 0;
    REVIEWS.forEach(function (r) {
        counts[r.rating] = (counts[r.rating] || 0) + 1;
        sum += r.rating;
    });
    var avg = (sum / total).toFixed(1);

    // Score
    var scoreEl2 = document.getElementById('dg-avg-score');
    if (scoreEl2) scoreEl2.textContent = avg;

    // Stars
    var starsEl2 = document.getElementById('dg-avg-stars');
    if (starsEl2) starsEl2.innerHTML = dgRenderStars(parseFloat(avg));

    // Total text
    var totalEl2 = document.getElementById('dg-total-text');
    if (totalEl2) totalEl2.innerHTML = 'Dựa trên <strong>' + total.toLocaleString('vi-VN') + '</strong> đánh giá thực tế';

    // Bars
    for (var i = 5; i >= 1; i--) {
        var pct = Math.round((counts[i] / total) * 100);
        var barEl = document.getElementById('bar-' + i);
        var pctEl2 = document.getElementById('pct-' + i);
        if (barEl) barEl.style.width = pct + '%';
        if (pctEl2) pctEl2.textContent = pct + '%';
    }
}
// ─── Filter ──────────────────────────────────────────────────────
function dgFilter(el) {
    _dgFilter = el.getAttribute('data-filter');

    document.querySelectorAll('.dg-filter-btn').forEach(function (b) {
        b.classList.remove('active');
    });
    el.classList.add('active');

    _dgHienTai = _dgPageSize;
    dgRender();
}

function dgGetFiltered() {
    var list = REVIEWS.slice();

    if (_dgFilter === '5') {
        list = list.filter(function (r) { return r.rating === 5; });
    } else if (_dgFilter === '4') {
        list = list.filter(function (r) { return r.rating === 4; });
    } else if (_dgFilter === 'hasImg') {
        list = list.filter(function (r) { return r.images && r.images.length > 0; });
    } else if (_dgFilter === 'newest') {
        list = list.slice().reverse();
    }

    return list;
}

// ─── Render Reviews ──────────────────────────────────────────────
function dgRender() {
    var container = document.getElementById('dg-review-list');
    if (!container) return;

    var filtered = dgGetFiltered();

    if (filtered.length === 0) {
        container.innerHTML =
            '<div class="text-center py-5">' +
                '<i class="fa-solid fa-comment-slash fa-3x text-muted mb-3 d-block"></i>' +
                '<p class="text-muted">Chưa có đánh giá nào cho bộ lọc này.</p>' +
            '</div>';
        _dgCapNhatNut(0, 0);
        return;
    }

    var hien = filtered.slice(0, _dgHienTai);

    container.innerHTML = hien.map(function (r) {
        var stars = dgRenderStars(r.rating);
        var imgHtml = '';
        if (r.images && r.images.length > 0) {
            imgHtml = '<div class="dg-review-imgs">' +
                r.images.map(function (src) {
                    return '<img src="' + src + '" alt="Ảnh đánh giá" loading="lazy" onerror="this.style.display=\'none\'">';
                }).join('') +
            '</div>';
        }

        var isLiked = _dgLiked[r.id];
        var likeCount = r.likes + (isLiked ? 1 : 0);

        return (
            '<div class="dg-review-card">' +
                '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">' +
                    '<div class="dg-reviewer">' +
                        '<img class="dg-avatar" src="' + r.avatar + '" alt="' + r.name + '" onerror="this.src=\'https://i.pravatar.cc/100\'">' +
                        '<div>' +
                            '<div class="dg-name">' + r.name + '</div>' +
                            '<div class="dg-meta">' +
                                '<span class="dg-stars">' + stars + '</span>' +
'<span>• ' + r.time + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<span class="dg-food-badge">' + r.food + '</span>' +
                '</div>' +
                '<p class="dg-review-text">' + r.text + '</p>' +
                imgHtml +
                '<div class="dg-actions">' +
                    '<button class="dg-action-btn ' + (isLiked ? 'liked' : '') + '" onclick="dgLike(' + r.id + ')">' +
                        '<i class="fa-solid fa-thumbs-up"></i> Hữu ích (' + likeCount + ')' +
                    '</button>' +
                    '<button class="dg-action-btn" onclick="dgReport(' + r.id + ')">' +
                        '<i class="fa-solid fa-flag"></i> Báo cáo' +
                    '</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');

    _dgCapNhatNut(hien.length, filtered.length);
}

// ─── Xem thêm ───────────────────────────────────────────────────
function _dgCapNhatNut(hien, total) {
    var btn = document.getElementById('btn-xem-them-dg');
    if (!btn) return;
    if (hien >= total) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'inline-block';
        btn.textContent = 'Xem thêm ' + (total - hien).toLocaleString('vi-VN') + ' đánh giá';
    }
}

function dgXemThem() {
    _dgHienTai += _dgPageSize;
    dgRender();
}

// ─── Like / Report ───────────────────────────────────────────────
function dgLike(id) {
    _dgLiked[id] = !_dgLiked[id];
    dgRender();
}

function dgReport(id) {
    alert('Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét đánh giá #' + id + '.');
}

// ─── Stars Helper ────────────────────────────────────────────────
function dgRenderStars(rating) {
    var full  = Math.floor(rating);
    var half  = (rating % 1) >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var s = '';
    for (var i = 0; i < full;  i++) s += '<i class="fa-solid fa-star"></i>';
    if (half)                        s += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (var j = 0; j < empty; j++) s += '<i class="fa-regular fa-star"></i>';
    return s;
}

// ─── Cart Badge ──────────────────────────────────────────────────
function dgCapNhatBadge() {
    var badge = document.getElementById('cart-badge');
    if (!badge) return;
    try {
        var cart = JSON.parse(localStorage.getItem('gioHang')) || [];
        var tong = cart.reduce(function (s, x) { return s + (x.soLuong || 1); }, 0);
        badge.textContent = tong > 99 ? '99+' : tong;
badge.style.display = tong > 0 ? 'inline-block' : 'none';
    } catch (e) {}
}