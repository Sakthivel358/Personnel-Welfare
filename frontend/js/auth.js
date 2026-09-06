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
