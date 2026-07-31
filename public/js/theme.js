/* ==================== THEME MANAGEMENT ==================== */

function initTheme() {
  const savedTheme = localStorage.getItem('ag_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Modo claro' : 'Modo oscuro');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ag_theme', newTheme);
  updateThemeIcon(newTheme);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});
