// BugHunt AI Demo App Client
(function () {
  const form = document.getElementById('profileForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const fullNameError = document.getElementById('fullNameError');
  const emailError = document.getElementById('emailError');
  const alertBox = document.getElementById('alertBox');
  const simulateApiFailure = document.getElementById('simulateApiFailure');
  const resetBtn = document.getElementById('resetBtn');
  const displayFullName = document.getElementById('displayFullName');
  const displayEmail = document.getElementById('displayEmail');
  const displayUpdatedAt = document.getElementById('displayUpdatedAt');
  const defectToggle = document.getElementById('defectToggle');
  const modeBadge = document.getElementById('modeBadge');

  // URL query params can override mode: ?mode=fixed or ?mode=defects; otherwise uses server default
  const urlParams = new URLSearchParams(window.location.search);
  let isFixedMode = urlParams.has('mode')
    ? urlParams.get('mode') === 'fixed'
    : Boolean(window.SERVER_DEFAULT_FIXED);

  function updateModeUI() {
    defectToggle.checked = isFixedMode;
    if (isFixedMode) {
      modeBadge.textContent = 'Demo App (Fixed Mode)';
      modeBadge.classList.add('fixed');
    } else {
      modeBadge.textContent = 'Demo App (Defects Active)';
      modeBadge.classList.remove('fixed');
    }
  }

  defectToggle.addEventListener('change', (e) => {
    isFixedMode = e.target.checked;
    updateModeUI();
  });

  function showAlert(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
    alertBox.textContent = '';
  }

  function clearErrors() {
    fullNameError.textContent = '';
    emailError.textContent = '';
    fullNameInput.classList.remove('is-invalid');
    emailInput.classList.remove('is-invalid');
  }

  async function loadProfile() {
    hideAlert();
    try {
      const res = await fetch(`/api/profile?mode=${isFixedMode ? 'fixed' : 'defects'}`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      fullNameInput.value = data.fullName || '';
      emailInput.value = data.email || '';
      displayFullName.textContent = data.fullName || '—';
      displayEmail.textContent = data.email || '—';
      displayUpdatedAt.textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : 'Initial load';
    } catch (err) {
      if (isFixedMode) {
        showAlert('Failed to load profile data from server.', 'error');
      } else {
        // Defect: silent failure, unhandled
        console.error('Unhandled profile load error:', err);
      }
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    hideAlert();

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const shouldFail = simulateApiFailure.checked;

    if (isFixedMode) {
      // --- FIXED MODE: Proper validation & error handling ---
      let hasError = false;
      if (!fullName) {
        fullNameError.textContent = 'Full Name is required.';
        fullNameInput.classList.add('is-invalid');
        hasError = true;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        emailError.textContent = 'Email address is required.';
        emailInput.classList.add('is-invalid');
        hasError = true;
      } else if (!emailPattern.test(email)) {
        emailError.textContent = 'Please enter a valid email address.';
        emailInput.classList.add('is-invalid');
        hasError = true;
      }

      if (hasError) {
        return;
      }

      try {
        const res = await fetch(`/api/profile?mode=fixed${shouldFail ? '&fail=true' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email, triggerFail: shouldFail })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server error (HTTP ${res.status})`);
        }

        const data = await res.json();
        displayFullName.textContent = data.fullName;
        displayEmail.textContent = data.email;
        displayUpdatedAt.textContent = new Date(data.updatedAt).toLocaleTimeString();
        showAlert('Profile updated successfully!', 'success');
      } catch (err) {
        showAlert(err.message || 'Unable to update profile. Server error occurred.', 'error');
      }
    } else {
      // --- DEFECT MODE: Deliberate bugs ---
      // Defect 1: No validation for invalid email
      // Defect 2: No validation for empty name
      // Defect 3: Server does not persist changes across refreshes (in server.js)
      // Defect 4: When API fails, unhandled error / no visible error banner shown to user

      if (shouldFail) {
        try {
          const res = await fetch('/api/profile?fail=true&mode=defects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, triggerFail: true })
          });
          // Defect: Does not check res.ok, does not display error banner
          console.error('API call failed silently with status:', res.status);
          // Leaves page without any visible error alert or notification
          return;
        } catch (err) {
          console.error('Unhandled network exception:', err);
          return;
        }
      }

      try {
        const res = await fetch('/api/profile?mode=defects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email })
        });
        const data = await res.json();
        // Displays success even if email or name was invalid
        displayFullName.textContent = data.fullName;
        displayEmail.textContent = data.email;
        displayUpdatedAt.textContent = new Date(data.updatedAt).toLocaleTimeString();
        showAlert('Profile updated successfully!', 'success');
      } catch (err) {
        console.error('Save error:', err);
      }
    }
  });

  resetBtn.addEventListener('click', loadProfile);

  updateModeUI();
  loadProfile();
})();
