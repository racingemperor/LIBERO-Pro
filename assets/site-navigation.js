// Shared by benchmark pages and the standalone publication/community pages.
const header = document.querySelector('.site-header');
const menu = header?.querySelector('.menu-button');
const navigation = header?.querySelector('.site-nav');
export const closeMenu = () => {
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
export function updateSiteNavigation(page) {
  const navPage = page === 'model' ? 'leaderboard' : ['task', 'perturbation'].includes(page) ? 'docs' : page;
  header?.querySelectorAll('a[aria-current]').forEach(link=>link.removeAttribute('aria-current'));
  header?.querySelector(`.site-nav a[href="${navPage}.html"],.site-links a[href="${navPage}.html"]`)?.setAttribute('aria-current', 'page');
  closeMenu();
}
updateSiteNavigation(document.body.dataset.page);
