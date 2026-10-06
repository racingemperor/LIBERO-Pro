(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const directory = document.getElementById('leaderboard-page-nav');
    if (!directory) return;

    const summary = directory.querySelector('summary');
    const links = [...directory.querySelectorAll('nav a')];
    const sections = links.map((link) => document.getElementById(link.hash.slice(1)));
    const desktop = window.matchMedia('(min-width: 1200px)');
    let framePending = false;
    let destinationHash = window.location.hash;

    function updateCurrentSection() {
      framePending = false;
      const positions = sections.map((section) => section.getBoundingClientRect().top);
      let activeIndex = 0;
      positions.forEach((top, index) => {
        if (top <= 112) activeIndex = index;
      });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        // Short final sections can share the same scroll limit. Honor the clicked
        // chapter while it is visible; manual scrolling resumes position tracking.
        const destinationIndex = links.findIndex((link) => link.hash === destinationHash);
        activeIndex = destinationIndex >= 0 && positions[destinationIndex] >= 0 && positions[destinationIndex] < window.innerHeight
          ? destinationIndex
          : sections.length - 1;
      }
      links.forEach((link, index) => {
        if (index === activeIndex) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function scheduleUpdate() {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(updateCurrentSection);
    }

    function openDestination(hash) {
      const target = sections.find((section) => `#${section.id}` === hash);
      if (!target) return null;
      destinationHash = hash;
      const disclosure = target.querySelector('details');
      if (disclosure) disclosure.open = true;
      return target;
    }

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = openDestination(link.hash);
        if (!desktop.matches) directory.open = false;
        // Keep native anchor navigation, browser history, and the current model/filter query.
        target?.focus({ preventScroll: true });
      });
    });

    directory.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !desktop.matches && directory.open) {
        directory.open = false;
        summary.focus({ preventScroll: true });
      }
    });

    directory.open = desktop.matches;
    desktop.addEventListener('change', () => {
      directory.open = desktop.matches;
      scheduleUpdate();
    });
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    function resumeScrollTracking(event) {
      if (directory.contains(event.target)) return;
      destinationHash = '';
      scheduleUpdate();
    }
    window.addEventListener('wheel', resumeScrollTracking, { passive: true });
    window.addEventListener('touchmove', resumeScrollTracking, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        resumeScrollTracking(event);
      }
    });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', () => {
      openDestination(window.location.hash);
      scheduleUpdate();
    });
    // Results and News load independently; update positions after either changes the layout.
    new ResizeObserver(scheduleUpdate).observe(document.getElementById('leaderboard-main'));
    document.addEventListener('leaderboard:ready', () => {
      // Restore a shared chapter link after the asynchronously loaded rows change its position.
      const target = openDestination(window.location.hash);
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
      scheduleUpdate();
    }, { once: true });
    openDestination(window.location.hash);
    updateCurrentSection();
  });
}());
