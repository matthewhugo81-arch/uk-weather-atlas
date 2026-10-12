/* Mobile-only accordion controls; existing form fields and map logic stay in place. */
(() => {
  const ageWrap = document.querySelector('.age-wrap');
  const ageSelect = document.getElementById('age');
  const modelLayer = document.querySelector('.model-layer');
  const ukvToggle = document.getElementById('ukv-mslp');
  if (!ageWrap || !ageSelect || !modelLayer || !ukvToggle ||
      ageWrap.classList.contains('mobile-collapsible')) return;

  function makeToggle(title, controlledIds) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-accordion-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', controlledIds);

    const copy = document.createElement('span');
    copy.className = 'mobile-toggle-copy';
    const heading = document.createElement('strong');
    heading.textContent = title;
    const status = document.createElement('small');
    status.className = 'mobile-toggle-status';
    copy.append(heading, status);

    const chevron = document.createElement('span');
    chevron.className = 'mobile-toggle-chevron';
    chevron.textContent = '⌄';
    chevron.setAttribute('aria-hidden', 'true');
    button.append(copy, chevron);
    return {button, status};
  }

  const age = makeToggle('Maximum observation age', 'age');
  const overlay = makeToggle('Model overlay', 'ukv-mslp ukv-options ukv-status');
  ageWrap.prepend(age.button);
  const legend = modelLayer.querySelector('legend');
  if (legend) legend.insertAdjacentElement('afterend', overlay.button);
  else modelLayer.prepend(overlay.button);

  function setCollapsed(section, button, collapsed) {
    section.classList.toggle('mobile-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
  }

  function syncSummaries() {
    const option = ageSelect.options[ageSelect.selectedIndex];
    age.status.textContent = option ? option.textContent.trim() : 'Select age';
    overlay.status.textContent = ukvToggle.checked ? 'UKV MSLP enabled' : 'UKV MSLP disabled';
  }

  ageWrap.classList.add('mobile-collapsible');
  modelLayer.classList.add('mobile-collapsible');
  setCollapsed(ageWrap, age.button, true);
  setCollapsed(modelLayer, overlay.button, true);
  syncSummaries();

  age.button.addEventListener('click', () => {
    setCollapsed(ageWrap, age.button, !ageWrap.classList.contains('mobile-collapsed'));
    syncSummaries();
  });
  overlay.button.addEventListener('click', () => {
    setCollapsed(modelLayer, overlay.button, !modelLayer.classList.contains('mobile-collapsed'));
    syncSummaries();
  });
  ageSelect.addEventListener('change', syncSummaries);
  ukvToggle.addEventListener('change', syncSummaries);
  document.getElementById('variable')?.addEventListener('change', syncSummaries);
  document.getElementById('rankings-panel')?.addEventListener('toggle', syncSummaries);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncSummaries();
  });

  // Other existing features may change the age or UKV setting programmatically.
  // Keep the collapsed labels accurate without modifying their event handlers.
  const phone = window.matchMedia('(max-width: 680px)');
  window.setInterval(() => {
    if (phone.matches && !document.hidden) syncSummaries();
  }, 5000);
})();
