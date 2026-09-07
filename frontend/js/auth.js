/**
 * Authentication & Session Manager for Front-end
 */

let currentUser = null;

const auth = {
  getUser: () => currentUser,
  saveUser: (u) => { currentUser = { ...currentUser, ...u }; },
  renderUserData: () => { if (currentUser) updateUserUI(currentUser); },
  logout: () => {
    if (typeof Utils !== 'undefined' && Utils.confirmLogout) {
      Utils.confirmLogout();
    } else if (confirm('Are you sure you want to sign out?')) {
      handleDirectLogout();
    }
  },
  directLogout: () => handleDirectLogout()
};

async function checkAuth(requiredRole = null) {
  try {
    const res = await api.getMe();
    if (res && res.success && res.user) {
      currentUser = res.user;
      updateUserUI(currentUser);

      if (requiredRole && currentUser.role !== requiredRole && currentUser.role !== 'ADMIN') {
        console.warn(`Role mismatch: requires ${requiredRole}, user has ${currentUser.role}`);
        if (currentUser.role === 'WELFARE_OFFICER') {
          window.location.href = '/welfare-officer.html';
        } else if (currentUser.role === 'ADMIN') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      }
      return currentUser;
    }
  } catch (err) {
    console.warn('[Auth Check] Not authenticated:', err.message);
    const isPublic = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname.endsWith('landing.html') || 
                     window.location.pathname.endsWith('login.html') || 
                     window.location.pathname.endsWith('signup.html') ||
                     window.location.pathname === '/';
    if (!isPublic) {
      window.location.href = '/login.html';
    }
  }
  return null;
}

function updateUserUI(user) {
  const nameEls = document.querySelectorAll('.user-name, [data-user="name"]');
  const roleEls = document.querySelectorAll('.user-role-badge, [data-user="role"]');
  const unitEls = document.querySelectorAll('[data-user="unit"]');
  const avatarEls = document.querySelectorAll('.user-avatar');

  nameEls.forEach(el => el.textContent = user.fullName || user.personnelId);
  roleEls.forEach(el => el.textContent = `${user.rank || ''} • ${user.role.replace('_', ' ')}`);
  unitEls.forEach(el => el.textContent = user.unit || 'CRPF Battalion 104');
  
  if (user.fullName) {
    const initials = user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    avatarEls.forEach(el => el.textContent = initials);
  }

  // If logged in as Welfare Officer, adapt sidebar and brand on any page that has a general sidebar
  if (user.role === 'WELFARE_OFFICER' || user.role === 'COMMANDING_OFFICER') {
    const isOfficerPortal = document.getElementById('officer-page-title');
    if (!isOfficerPortal) {
      const path = window.location.pathname;
      const isEarlyWarning = path.endsWith('early-warning.html');
      const isPrivacy = path.endsWith('privacy.html');
      const isHelp = path.endsWith('help.html');
      const isSettings = path.endsWith('settings.html');
      const isProfile = path.endsWith('profile.html');

      // Update sidebar menus
      document.querySelectorAll('.sidebar-menu').forEach(menu => {
        menu.innerHTML = `
          <li class="menu-category">Triage & Supervision</li>
          <li class="menu-item"><a href="/welfare-officer.html#dashboard-section"><span class="menu-icon">📊</span> AI Triage & Alerts</a></li>
          <li class="menu-item ${isEarlyWarning ? 'active' : ''}"><a href="/early-warning.html"><span class="menu-icon">⚡</span> Early-Warning Center</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#roster-section"><span class="menu-icon">👥</span> Unit Personnel Roster</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#optimizer-section"><span class="menu-icon">🛡️</span> AI Roster Optimizer</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#followups-section"><span class="menu-icon">🔄</span> Follow-up & Re-analysis</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#support-section"><span class="menu-icon">📥</span> Support Requests Queue</a></li>

          <li class="menu-category">System</li>
          <li class="menu-item ${isPrivacy ? 'active' : ''}"><a href="/privacy.html"><span class="menu-icon">🔒</span> Privacy & Safeguards</a></li>
          <li class="menu-item ${isHelp ? 'active' : ''}"><a href="/help.html"><span class="menu-icon">❓</span> Help & Directory</a></li>
          <li class="menu-item ${isSettings ? 'active' : ''}"><a href="/settings.html"><span class="menu-icon">⚙️</span> Settings</a></li>
        `;
      });

      // Update sidebar brand title/sub/icon
      document.querySelectorAll('.sidebar-header .brand-icon').forEach(icon => {
        icon.textContent = '🩺';
        icon.style.background = 'linear-gradient(135deg, #059669, #10b981)';
      });
      document.querySelectorAll('.sidebar-brand-sub').forEach(sub => {
        sub.textContent = 'Welfare Intelligence';
      });

      // Update avatars
      avatarEls.forEach(el => {
        el.style.background = '#059669';
      });
    }
  } else if (user.role === 'ADMIN') {
    const isAdminPortal = document.getElementById('admin-page-title');
    if (!isAdminPortal) {
      const path = window.location.pathname;
      const isPrivacy = path.endsWith('privacy.html');
      const isHelp = path.endsWith('help.html');
      const isSettings = path.endsWith('settings.html');

      document.querySelectorAll('.sidebar-menu').forEach(menu => {
        menu.innerHTML = `
          <li class="menu-category">Administration</li>
          <li class="menu-item"><a href="/admin.html"><span class="menu-icon">🛡️</span> System Governance</a></li>

          <li class="menu-category">System</li>
          <li class="menu-item ${isPrivacy ? 'active' : ''}"><a href="/privacy.html"><span class="menu-icon">🔒</span> Privacy & Safeguards</a></li>
          <li class="menu-item ${isHelp ? 'active' : ''}"><a href="/help.html"><span class="menu-icon">❓</span> Help & Directory</a></li>
          <li class="menu-item ${isSettings ? 'active' : ''}"><a href="/settings.html"><span class="menu-icon">⚙️</span> Settings</a></li>
        `;
      });
    }
  }

  // Make user mini card interactive
  const miniCards = document.querySelectorAll('.user-mini-card');
  miniCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.title = 'Click to open My Profile';
    card.onclick = (e) => {
      if (e.target.closest('.logout-btn')) return;
      window.location.href = '/profile.html';
    };
  });

  // Prevent page reload / scroll-to-top jump when clicking current page link
  document.querySelectorAll('.sidebar-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const currentPath = window.location.pathname;
    if (href === currentPath || href === currentPath.substring(1) || (currentPath === '/' && href === '/dashboard.html')) {
      a.addEventListener('click', (e) => {
        if (!a.getAttribute('onclick')) {
          e.preventDefault();
        }
      });
    }
  });
}

async function handleDirectLogout() {
  try {
    await api.logout();
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast('You have been signed out securely.', 'success');
    }
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 400);
  } catch (err) {
    window.location.href = '/login.html';
  }
}

// Theme handling
function initTheme() {
  const savedTheme = localStorage.getItem('sih_welfare_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const themeToggles = document.querySelectorAll('.theme-toggle');
  themeToggles.forEach(btn => {
    btn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('sih_welfare_theme', nextTheme);
      themeToggles.forEach(b => b.innerHTML = nextTheme === 'dark' ? '☀️' : '🌙');
    });
  });
}

// Mobile sidebar toggle
function initSidebar() {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const sidebar = document.querySelector('.app-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();

  // Enforce confirmation on all logout buttons
  document.body.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('.logout-btn');
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      auth.logout();
    }
  });

  // Make bottom mini cards clickable to Profile
  document.querySelectorAll('.user-mini-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.title = 'Click to view full profile & credentials';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.logout-btn')) return;
      window.location.href = '/profile.html';
    });
  });
});
