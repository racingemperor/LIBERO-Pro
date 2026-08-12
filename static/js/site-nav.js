document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.querySelector('.site-menu-toggle');
    const menu = document.getElementById('site-menu');

    if (!toggle || !menu) return;

    function closeMenu() {
        toggle.classList.remove('is-active');
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('title', 'Open navigation');
    }

    toggle.addEventListener('click', function() {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            closeMenu();
            return;
        }

        toggle.classList.add('is-active');
        menu.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('title', 'Close navigation');
    });

    menu.addEventListener('click', function(event) {
        if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeMenu();
    });
});
