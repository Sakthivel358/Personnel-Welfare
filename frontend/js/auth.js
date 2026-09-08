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
      try {
        if (typeof localStorage !== 'undefined') {
          const prev = JSON.parse(localStorage.getItem('sih_user') || '{}');
          localStorage.setItem('sih_user', JSON.stringify({ ...prev, ...res.user }));
        }
      } catch(e) {}
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

  nameEls.forEach(el => el.textContent = user.fullName || user.personnelId || 'Personnel Member');
  const roleText = (user.role || 'PERSONNEL').replace(/_/g, ' ');
  roleEls.forEach(el => el.textContent = `${user.rank || 'Personnel'} • ${roleText}`);
  unitEls.forEach(el => el.textContent = user.unit || 'CRPF Battalion 104');
  
  const avatarVal = user.profileImage || (typeof localStorage !== 'undefined' && localStorage.getItem('sih_user_avatar'));
  if (avatarVal) {
    avatarEls.forEach(el => {
      if (avatarVal.startsWith('<svg') || avatarVal.includes('<svg')) {
        el.innerHTML = avatarVal;
      } else {
        el.innerHTML = `<img src="${avatarVal}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
      }
    });
  } else if (user.fullName) {
    const initials = user.fullName.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'ME';
    avatarEls.forEach(el => {
      el.innerHTML = '';
      el.textContent = initials;
    });
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
          <li class="menu-item"><a href="/welfare-officer.html#dashboard-section"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span> AI Triage & Alerts</a></li>
          <li class="menu-item ${isEarlyWarning ? 'active' : ''}"><a href="/early-warning.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Early-Warning Center</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#roster-section"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span> Unit Personnel Roster</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#optimizer-section"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> AI Roster Optimizer</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#followups-section"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg></span> Follow-up & Re-analysis</a></li>
          <li class="menu-item"><a href="/welfare-officer.html#support-section"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span> Support Requests Queue</a></li>

          <li class="menu-category">System</li>
          <li class="menu-item ${isPrivacy ? 'active' : ''}"><a href="/privacy.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span> Privacy & Safeguards</a></li>
          <li class="menu-item ${isHelp ? 'active' : ''}"><a href="/help.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></span> Help & Directory</a></li>
          <li class="menu-item ${isSettings ? 'active' : ''}"><a href="/settings.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span> Settings</a></li>
        `;
      });

      // Update sidebar brand title/sub/icon
      document.querySelectorAll('.sidebar-header .brand-icon').forEach(icon => {
        icon.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
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
          <li class="menu-item"><a href="/admin.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> System Governance</a></li>

          <li class="menu-category">System</li>
          <li class="menu-item ${isPrivacy ? 'active' : ''}"><a href="/privacy.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span> Privacy & Safeguards</a></li>
          <li class="menu-item ${isHelp ? 'active' : ''}"><a href="/help.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></span> Help & Directory</a></li>
          <li class="menu-item ${isSettings ? 'active' : ''}"><a href="/settings.html"><span class="menu-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span> Settings</a></li>
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

  // Auto-initialize UI immediately from cached session so there is never a "VK" flicker
  try {
    const cachedUser = JSON.parse(localStorage.getItem('sih_user') || localStorage.getItem('sih_registered_user') || 'null');
    if (cachedUser) {
      updateUserUI(cachedUser);
    }
  } catch(e) {}
});
