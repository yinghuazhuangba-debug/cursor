// Preload kept minimal — app uses localStorage only, no Node bridge needed.
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.desktop = '1'
})
