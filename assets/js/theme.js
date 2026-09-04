(function () {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');

  if (!button) return;

  button.addEventListener('click', function () {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
})();
