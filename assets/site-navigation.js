// Shared by benchmark pages and the standalone publication/community pages.
const header = document.querySelector('.site-header');
const menu = header?.querySelector('.menu-button');
const navigation = header?.querySelector('.site-nav');
const closeMenu = () => {
  navigation?.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
};
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation?.classList.toggle('open', open);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || menu?.getAttribute('aria-expanded') !== 'true') return;
  closeMenu();
  menu.focus();
});
document.addEventListener('click', event => {
  if (!header?.contains(event.target) || event.target.closest('.site-nav a')) closeMenu();
});
const page = document.body.dataset.page;
const navPage = page === 'model' ? 'leaderboard' : ['task', 'perturbation'].includes(page) ? 'docs' : page;
header?.querySelector(`a[href="${navPage}.html"]`)?.setAttribute('aria-current', 'page');
