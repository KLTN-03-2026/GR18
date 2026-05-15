/**
 * Bật/tắt hiển thị mật khẩu cho các ô có nút .password-toggle-btn
 */
(function () {
    function bindToggle(btn) {
        if (btn.dataset.passwordToggleBound === '1') return;
        btn.dataset.passwordToggleBound = '1';

        const group = btn.closest('.input-group');
        const input = group && group.querySelector('input');
        const icon = btn.querySelector('.password-toggle-icon');
        if (!input || !icon) return;

        btn.addEventListener('click', function () {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            icon.classList.toggle('fa-eye', !show);
            icon.classList.toggle('fa-eye-slash', show);
            btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        });
    }

    function initPasswordToggles(root) {
        const scope = root || document;
        scope.querySelectorAll('.password-toggle-btn').forEach(bindToggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initPasswordToggles();
        });
    } else {
        initPasswordToggles();
    }

    window.initPasswordToggles = initPasswordToggles;
})();
