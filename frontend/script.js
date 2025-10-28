// ===== Global State =====
let events = [];
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false;
let currentView = "week"; // Default view
let editingEvent = null;
let activeEventId = null;
let currentUser = null;
let jwtToken = null;
let sharingCalendarId = null;
const eventCache = new Map();

let allCalendars = { owned: [], shared: [] };
let selectedCalendarId = null;

let userStats = {
  weeklyPoints: 0,
  lifetimePoints: 0,
  currentStreak: 0,
  dailyTasksCompleted: 0
};

// Modal trap cleanup function
let activeModalTrap = null;

// ===== Utility Functions =====

// Show loading spinner
function showLoading() {
  document.getElementById('loadingSpinner')?.classList.remove('hidden');
}

// Hide loading spinner
function hideLoading() {
  document.getElementById('loadingSpinner')?.classList.add('hidden');
}

// Toast notification system
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Load settings from localStorage
function loadSettings() {
  try {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") {
      document.body.classList.add("dark-mode");
      const toggle = document.getElementById("darkModeToggle");
      if (toggle) toggle.textContent = "Toggle Light Mode";
    }
    
    const savedButtonColor = localStorage.getItem("buttonColor");
    if (savedButtonColor) {
      const picker = document.getElementById("buttonColorPicker");
      const preset = document.getElementById("buttonColorPreset");
      if (picker) picker.value = savedButtonColor;
      if (preset) preset.value = savedButtonColor;
      updateButtonColor(savedButtonColor);
    }
    
    const savedToken = localStorage.getItem("jwtToken");
    const savedUser = localStorage.getItem("currentUser");
    if (savedToken && savedUser) {
      jwtToken = savedToken;
      currentUser = JSON.parse(savedUser);
      updateAuthUI();
      loadCalendars();
      fetchEvents();
    }
    
    // Initialize visible calendars
    initVisibleCalendars();
  } catch (e) {
    console.error("Failed to load settings:", e);
    showToast("Error loading settings", "error");
  }
}

// Initialize visible calendars from localStorage
function initVisibleCalendars() {
  const saved = localStorage.getItem('visibleCalendars');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      window.visibleCalendars = new Set(parsed);
    } catch (e) {
      window.visibleCalendars = new Set();
    }
  } else {
    window.visibleCalendars = new Set();
  }
}

function saveVisibleCalendars() {
  if (window.visibleCalendars) {
    localStorage.setItem('visibleCalendars', JSON.stringify([...window.visibleCalendars]));
  }
}

// Filter events by visible calendars
function getFilteredEvents() {
  if (!window.visibleCalendars || window.visibleCalendars.size === 0) {
    return events;
  }
  return events.filter(event => {
    const calId = event.calendar?._id || event.calendar;
    return window.visibleCalendars.has(calId);
  });
}

// Fetch events from backend
async function fetchEvents() {
  if (!currentUser || !jwtToken) return;
  
  try {
    showLoading();
    console.log('Fetching events for user:', currentUser?.username);
    
    const response = await fetch('/api/events', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }
    
    events = await response.json();
    events = events.map(e => ({
      ...e,
      id: e._id,
      date: e.date.split('T')[0],
      completed: e.completed || false,
      pointsAwarded: e.pointsAwarded || 0
    }));
    
    eventCache.clear();
    updateView();
    showToast('Events loaded successfully', 'success');
  } catch (e) {
    console.error("Failed to fetch events:", e);
    showToast("Error fetching events", "error");
  } finally {
    hideLoading();
  }
}

// Handle unauthorized access
function handleUnauthorized() {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("currentUser");
  events = [];
  updateAuthUI();
  updateView();
  showToast("Session expired. Please log in again", "warning");
  openModal('loginModal');
}

// Parse date string to Date object
function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

// Format time for display
function formatTimeForDisplay(event) {
  if (event.isAllDay) return "All Day";
  
  let timeStr = event.time || "00:00";
  let endStr = event.endTime ? ` - ${event.endTime}` : "";
  
  if (use24Hour) return timeStr + endStr;
  
  // Convert to 12-hour format
  let [hour, minute] = timeStr.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  timeStr = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
  
  if (event.endTime) {
    [hour, minute] = event.endTime.split(":").map(Number);
    const endAmpm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    endStr = ` - ${hour}:${String(minute).padStart(2, "0")} ${endAmpm}`;
  }
  
  return timeStr + endStr;
}

// Get time in minutes from HH:MM string
function getTimeInMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hour, min] = timeStr.split(":").map(Number);
  return hour * 60 + min;
}

// Show error message in modal
function showErrorMessage(message, targetModal = null) {
  if (targetModal) {
    let errorDiv = targetModal.querySelector("#errorMessage");
    if (!errorDiv) {
      errorDiv = document.createElement("div");
      errorDiv.id = "errorMessage";
      const content = targetModal.querySelector(".modal-content");
      if (content) content.prepend(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    setTimeout(() => errorDiv.style.display = "none", 3000);
  } else {
    showToast(message, "error");
  }
}

// Check if date matches
function matchesDate(ev, date) {
  const evDate = parseDateOnly(ev.date);
  if (!evDate) return false;
  return evDate.toDateString() === date.toDateString();
}

// Resize image before upload
async function resizeImage(file, maxWidth = 200, maxHeight = 200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      reject(new Error('Invalid file type. Use JPG, PNG, GIF, or WebP'));
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image too large. Max 5MB'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64
        canvas.toBlob(
          (blob) => {
            const resizedReader = new FileReader();
            resizedReader.onload = () => resolve(resizedReader.result);
            resizedReader.onerror = reject;
            resizedReader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Get events for a specific date (including recurring instances)
function getEventsForDate(targetDate) {
  const cacheKey = targetDate.toDateString();
  if (eventCache.has(cacheKey)) return eventCache.get(cacheKey);

  const sourceEvents = getFilteredEvents();

  let result = sourceEvents
    .filter(ev => matchesDate(ev, targetDate))
    .map(ev => ({ 
      ...ev, 
      instanceDate: targetDate.toISOString().split('T')[0], 
      isInstance: false 
    }));

  // Add recurring instances
  sourceEvents.forEach(ev => {
    if (!ev.recurrence?.frequency) return;
    const startDate = parseDateOnly(ev.date);
    if (!startDate || startDate > targetDate) return;

    let current = new Date(startDate);
    let count = 0;
    const maxInstances = 200;

    while (current <= targetDate && count < maxInstances) {
      if (matchesDate({ date: current.toISOString().split('T')[0] }, targetDate)) {
        const instanceDateStr = targetDate.toISOString().split('T')[0];
        if (!result.some(r => r.id === ev.id && r.instanceDate === instanceDateStr)) {
          result.push({
            ...ev,
            instanceDate: instanceDateStr,
            isInstance: true,
            displayTitle: `${ev.title} (recurring)`
          });
        }
      }
      
      switch (ev.recurrence.frequency) {
        case 'daily': 
          current.setDate(current.getDate() + 1); 
          break;
        case 'weekly': 
          current.setDate(current.getDate() + 7); 
          break;
        case 'monthly': 
          current.setMonth(current.getMonth() + 1); 
          break;
      }
      count++;
    }
  });

  // Sort: all-day events first, then by time
  result.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return (a.time || "00:00").localeCompare(b.time || "00:00");
  });

  eventCache.set(cacheKey, result);
  return result;
}

// Update button color theme
function updateButtonColor(color) {
  if (!color) return;

  const root = document.documentElement;
  const isDarkMode = document.body.classList.contains("dark-mode");
  const hoverColor = adjustColorBrightness(color, isDarkMode ? 1.2 : 0.8);
  
  root.style.setProperty("--button-bg", color);
  root.style.setProperty("--button-hover-bg", hoverColor);
  root.style.setProperty("--event-box-bg", color);
  root.style.setProperty("--event-box-dark-bg", adjustColorBrightness(color, 1.2));
  
  localStorage.setItem("buttonColor", color);
}

// Update calendar title button
function updateCalendarTitle() {
  const titleBtn = document.getElementById('calendarTitleButton');
  const titleText = document.getElementById('calendarTitleText');
  const colorDot = titleBtn?.querySelector('.calendar-color-dot');
  
  if (!titleText || !colorDot) return;
  
  const selectedCal = allCalendars.owned.find(c => c._id === selectedCalendarId) ||
                      allCalendars.shared.find(c => c._id === selectedCalendarId);
  
  if (selectedCal) {
    titleText.textContent = selectedCal.name;
    colorDot.style.background = selectedCal.color;
  } else {
    titleText.textContent = 'My Calendar';
    colorDot.style.background = '#3788d8';
  }
}

// Adjust color brightness
function adjustColorBrightness(hex, factor) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)));
  
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

// Get random pastel color
function getRandomPastelColor() {
  const pastels = [
    '#A7C7E7', '#B19CD9', '#FFAAA5', '#B5EAD7', '#CFC7FF', 
    '#FFD670', '#DAF7A6', '#FFC3A0', '#FFABAB', '#B5F7FF'
  ];
  return pastels[Math.floor(Math.random() * pastels.length)];
}

// Get smart default time (rounded to nearest 30 min)
function getSmartDefaultTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  
  now.setMinutes(roundedMinutes);
  now.setSeconds(0);
  
  return {
    hour: now.getHours(),
    minute: now.getMinutes() % 60
  };
}

// Update form validation state
function updateValidationState() {
  const titleInput = document.getElementById('eventTitle');
  const dateInput = document.getElementById('eventDate');
  const submitBtn = document.querySelector('#eventForm button[type="submit"]');
  
  if (!titleInput || !dateInput || !submitBtn) return;
  
  const title = titleInput.value.trim();
  const date = dateInput.value;
  
  titleInput.style.borderColor = title ? '#4caf50' : '#ddd';
  dateInput.style.borderColor = date ? '#4caf50' : '#ddd';
  
  submitBtn.disabled = !title || !date;
}

// Update character counters
function updateCharCount(inputId, countId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  
  if (!input || !counter) return;
  
  input.addEventListener('input', () => {
    const current = input.value.length;
    counter.textContent = current;
    
    if (current > max * 0.9) {
      counter.style.color = '#f44336';
    } else if (current > max * 0.7) {
      counter.style.color = '#ff9800';
    } else {
      counter.style.color = '#666';
    }
  });
}

// ===== Gamification Functions =====

// Fetch user stats
async function fetchUserStats() {
  if (!currentUser || !jwtToken) return;
  
  try {
    const res = await fetch('/api/gamification/stats', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Failed to fetch stats');
    
    userStats = await res.json();
    updateStatsDisplay();
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  }
}

// Update stats display
function updateStatsDisplay() {
  const weeklyEl = document.getElementById('weeklyPointsDisplay');
  const lifetimeEl = document.getElementById('lifetimePointsDisplay');
  const streakEl = document.getElementById('streakDisplay');
  
  if (weeklyEl) weeklyEl.textContent = userStats.weeklyPoints || 0;
  if (lifetimeEl) lifetimeEl.textContent = userStats.lifetimePoints || 0;
  if (streakEl) streakEl.textContent = userStats.currentStreak || 0;
}

// Mark event as complete
async function markEventComplete(eventId, checkboxEl) {
  if (!currentUser || !jwtToken) return;
  
  try {
    showLoading();
    
    const res = await fetch(`/api/gamification/complete/${eventId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to complete event');
    }
    
    const result = await res.json();
    
    // Update event in local array
    const event = events.find(e => e.id === eventId);
    if (event) {
      event.completed = true;
      event.pointsAwarded = result.pointsAwarded;
    }
    
    // Update stats
    userStats = result.userStats;
    updateStatsDisplay();
    
    // Show success message
    if (result.pointsAwarded > 0) {
      showToast(`🎉 +${result.pointsAwarded} points! Keep it up!`, 'success');
    } else if (!result.isEligible) {
      showToast('Task completed (no points - check eligibility rules)', 'info');
    } else {
      showToast('Task completed!', 'success');
    }
    
    // Refresh view and leaderboard
    eventCache.clear();
    updateView();
    loadLeaderboard();
  } catch (e) {
    console.error('Complete event error:', e);
    showToast(e.message || 'Failed to complete task', 'error');
    if (checkboxEl) checkboxEl.checked = false;
  } finally {
    hideLoading();
  }
}

// Uncomplete event
async function markEventUncomplete(eventId, checkboxEl) {
  if (!currentUser || !jwtToken) return;
  
  try {
    showLoading();
    
    const res = await fetch(`/api/gamification/uncomplete/${eventId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to uncomplete event');
    }
    
    const result = await res.json();
    
    // Update event
    const event = events.find(e => e.id === eventId);
    if (event) {
      event.completed = false;
      event.pointsAwarded = 0;
    }
    
    // Update stats
    userStats = result.userStats;
    updateStatsDisplay();
    
    showToast('Task uncompleted', 'info');
    
    // Refresh view and leaderboard
    eventCache.clear();
    updateView();
    loadLeaderboard();
  } catch (e) {
    console.error('Uncomplete event error:', e);
    showToast(e.message || 'Failed to uncomplete task', 'error');
    if (checkboxEl) checkboxEl.checked = true;
  } finally {
    hideLoading();
  }
}

// Load leaderboard
async function loadLeaderboard() {
  const leaderboardEl = document.getElementById('leaderboardList');
  if (!leaderboardEl) return;
  
  if (!currentUser || !jwtToken) {
    leaderboardEl.innerHTML = '<p class="no-friends" style="padding:20px;text-align:center;color:#666;">Log in to see leaderboard</p>';
    return;
  }
  
  try {
    const res = await fetch('/api/gamification/leaderboard', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Failed to load leaderboard');
    
    const leaderboard = await res.json();
    
    if (leaderboard.length === 0) {
      leaderboardEl.innerHTML = `
        <div class="no-leaderboard">
          <div class="no-leaderboard-icon">🏆</div>
          <h4>No Friends Yet</h4>
          <p>Add friends to compete on the leaderboard!</p>
        </div>
      `;
      return;
    }
    
    leaderboardEl.innerHTML = '';
    
    leaderboard.forEach(user => {
      const div = document.createElement('div');
      div.className = 'leaderboard-item' + (user.isCurrentUser ? ' current-user' : '');
      
      const rankClass = user.rank <= 3 ? ` rank-${user.rank}` : '';
      const rankEmoji = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '';
      
      const initials = (user.displayName || user.username)[0].toUpperCase();
      const avatarContent = user.profileImage 
        ? `<img src="${user.profileImage}" alt="">` 
        : initials;
      
      div.innerHTML = `
        <div class="leaderboard-rank${rankClass}">
          ${rankEmoji || user.rank}
        </div>
        <div class="leaderboard-avatar">
          ${avatarContent}
        </div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">
            ${user.displayName || user.username}
            ${user.isCurrentUser ? ' (You)' : ''}
          </div>
        </div>
        <div class="leaderboard-points">
          ${user.weeklyPoints} pts
        </div>
      `;
      
      leaderboardEl.appendChild(div);
    });
  } catch (e) {
    console.error('Load leaderboard error:', e);
    leaderboardEl.innerHTML = '<p style="text-align:center;color:#f44336;padding:20px;">Failed to load leaderboard</p>';
  }
}

// Setup friends tabs
function setupFriendsTabs() {
  const tabs = document.querySelectorAll('.friends-tab');
  const tabContents = document.querySelectorAll('.friends-tab-content');
  
  tabs.forEach(tab => {
    tab.onclick = () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update visible content
      tabContents.forEach(content => {
        if (content.id === `${targetTab}${targetTab === 'friends' ? 'List' : ''}Tab`) {
          content.classList.add('active');
          content.classList.remove('hidden');
        } else {
          content.classList.remove('active');
          content.classList.add('hidden');
        }
      });
      
      // Load leaderboard if that tab is clicked
      if (targetTab === 'leaderboard') {
        loadLeaderboard();
      }
    };
  });
}

// ===== DOM Elements =====
const monthYear = document.getElementById("monthYear");
const calendarBody = document.getElementById("calendarBody");
const bigCalendarBody = document.getElementById("bigCalendarBody");
const yearTitle = document.getElementById("yearTitle");
const yearGrid = document.getElementById("yearGrid");
const monthTitle = document.getElementById("monthTitle");
const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const yearView = document.getElementById("yearView");
const createEventBtn = document.getElementById("createEventButton");
const viewAllEventsBtn = document.getElementById("viewAllEventsButton");
const timeFormatToggle = document.getElementById("timeFormatToggle");
const darkModeToggle = document.getElementById("darkModeToggle");
const buttonColorPicker = document.getElementById("buttonColorPicker");
const buttonColorPreset = document.getElementById("buttonColorPreset");
const eventColorPicker = document.getElementById("eventColorPicker");
const eventColorPreset = document.getElementById("eventColorPreset");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const prevMonthMain = document.getElementById("prevMonthMain");
const nextMonthMain = document.getElementById("nextMonthMain");
const prevYear = document.getElementById("prevYear");
const nextYear = document.getElementById("nextYear");
const eventModal = document.getElementById("eventModal");
const eventForm = document.getElementById("eventForm");
const eventTitleInput = document.getElementById("eventTitle");
const eventDateInput = document.getElementById("eventDate");
const eventHourInput = document.getElementById("eventHour");
const eventMinuteInput = document.getElementById("eventMinute");
const eventAMPMSelect = document.getElementById("eventAMPM");
const eventDetailsInput = document.getElementById("eventDetails");
const eventLocationInput = document.getElementById("eventLocation");
const allDayCheckbox = document.getElementById("allDayCheckbox");
const untilCheckbox = document.getElementById("untilCheckbox");
const eventEndHourInput = document.getElementById("eventEndHour");
const eventEndMinuteInput = document.getElementById("eventEndMinute");
const eventEndAMPMSelect = document.getElementById("eventEndAMPM");
const timeInputs = document.getElementById("timeInputs");
const untilContainer = document.getElementById("untilContainer");
const endTimeInputs = document.getElementById("endTimeInputs");
const detailsModal = document.getElementById("detailsModal");
const detailsContent = document.getElementById("detailsContent");
const deleteEventBtn = document.getElementById("deleteEventButton");
const editEventBtn = document.getElementById("editEventButton");
const loginModal = document.getElementById("loginModal");
const authForm = document.getElementById("authForm");
const authSubmit = document.getElementById("authSubmit");
const toggleAuth = document.getElementById("toggleAuth");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const emailInput = document.getElementById("email");
const authMessage = document.getElementById("authMessage");
const logInButton = document.getElementById("logInButton");
const logOutButton = document.getElementById("logOutButton");
const userStatus = document.getElementById("userStatus");
const recurrenceCheckbox = document.getElementById("recurrenceCheckbox");
const recurrenceFrequency = document.getElementById("recurrenceFrequency");
const friendsModal = document.getElementById('friendsModal');
const friendSearch = document.getElementById('friendSearch');
const searchFriendBtn = document.getElementById('searchFriendBtn');
const friendSearchResults = document.getElementById('friendSearchResults');
const friendRequestsDiv = document.getElementById('friendRequestsDiv');
const friendsListDiv = document.getElementById('friendsListDiv');
const manageFriendsBtn = document.getElementById('manageFriendsBtn');
const allEventsModal = document.getElementById("allEventsModal");
const allEventsList = document.getElementById("allEventsList");
const profileContainer = document.getElementById("profileContainer");
const profileButton = document.getElementById("profileButton");
const profileImage = document.getElementById("profileImage");
const profileInitials = document.getElementById("profileInitials");
const profileMenu = document.getElementById("profileMenu");
const menuProfileImage = document.getElementById("menuProfileImage");
const menuProfileInitials = document.getElementById("menuProfileInitials");
const menuUsername = document.getElementById("menuUsername");
const menuEmail = document.getElementById("menuEmail");
const profileSettingsBtn = document.getElementById("profileSettingsBtn");
const accountSettingsBtn = document.getElementById("accountSettingsBtn");
const logOutButtonMenu = document.getElementById("logOutButtonMenu");
const profileSettingsModal = document.getElementById("profileSettingsModal");
const profileForm = document.getElementById("profileForm");
const profileImageInput = document.getElementById("profileImageInput");
const currentProfileImage = document.getElementById("currentProfileImage");
const displayName = document.getElementById("displayName");
const profileBio = document.getElementById("profileBio");
const accountSettingsModal = document.getElementById("accountSettingsModal");
const accountForm = document.getElementById("accountForm");
const accUsername = document.getElementById("accUsername");
const accEmail = document.getElementById("accEmail");
const accNewPassword = document.getElementById("accNewPassword");
const calendarModal = document.getElementById('calendarModal');
const createCalendarBtn = document.getElementById('createCalendarBtn');
const calendarsList = document.getElementById('calendarsList');
const calendarFormModal = document.getElementById('calendarFormModal');
const calendarForm = document.getElementById('calendarForm');
const calendarNameInput = document.getElementById('calendarName');
const calendarColorInput = document.getElementById('calendarColor');
const calendarDescriptionInput = document.getElementById('calendarDescription');
const deleteCalendarBtn = document.getElementById('deleteCalendarBtn');
const calendarFormTitle = document.getElementById('calendarFormTitle');
const manageCalendarsTopBtn = document.getElementById('manageCalendarsTopBtn');

let editingCalendarId = null;

// ===== Authentication =====

function updateAuthUI() {
  if (currentUser) {
    profileContainer?.classList.remove("hidden");
    logInButton?.classList.add("hidden");
    createEventBtn?.classList.remove("hidden");
    viewAllEventsBtn?.classList.remove("hidden");
    manageCalendarsTopBtn?.classList.remove('hidden');
    updateProfileUI();
    fetchUserStats();
  } else {
    profileContainer?.classList.add("hidden");
    logInButton?.classList.remove("hidden");
    createEventBtn?.classList.add("hidden");
    viewAllEventsBtn?.classList.add("hidden");
    manageCalendarsTopBtn?.classList.add('hidden');
    events = [];
    updateView();
  }
}

function updateProfileUI() {
  if (!currentUser) return;
  
  if (menuUsername) menuUsername.textContent = currentUser.username;
  if (menuEmail) menuEmail.textContent = currentUser.email || "";
  
  if (currentUser.profileImage) {
    [profileImage, menuProfileImage].forEach(img => {
      if (img) {
        img.src = currentUser.profileImage;
        img.classList.remove("hidden");
      }
    });
    [profileInitials, menuProfileInitials].forEach(el => {
      if (el) el.classList.add("hidden");
    });
  } else {
    const initials = (currentUser.displayName || currentUser.username)[0].toUpperCase();
    [profileInitials, menuProfileInitials].forEach(el => {
      if (el) {
        el.textContent = initials;
        el.classList.remove("hidden");
      }
    });
    [profileImage, menuProfileImage].forEach(img => {
      if (img) img.classList.add("hidden");
    });
  }
}

async function handleLogin(username, password) {
  try {
    showLoading();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    
    jwtToken = data.token;
    currentUser = data.user;
    localStorage.setItem("jwtToken", jwtToken);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    
    if (authMessage) {
      authMessage.textContent = "Login successful!";
      authMessage.style.color = "#4caf50";
    }
    
    // Load calendars and create default if none exist
    await loadCalendars();
    if (allCalendars.owned.length === 0) {
      await createCalendarAPI('My Calendar', '#3788d8', 'Default calendar');
      await loadCalendars();
    }
    
    showToast('Welcome back, ' + currentUser.username + '!', 'success');
    return true;
  } catch (e) {
    if (authMessage) authMessage.textContent = e.message;
    showToast(e.message, 'error');
    return false;
  } finally {
    hideLoading();
  }
}

async function handleRegister(username, password, email) {
  try {
    showLoading();
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email: email || undefined })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    
    jwtToken = data.token;
    currentUser = data.user;
    localStorage.setItem("jwtToken", jwtToken);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    
    if (authMessage) {
      authMessage.textContent = "Registration successful!";
      authMessage.style.color = "#4caf50";
    }
    
    showToast('Account created successfully!', 'success');
    return true;
  } catch (e) {
    if (authMessage) authMessage.textContent = e.message;
    showToast(e.message, 'error');
    return false;
  } finally {
    hideLoading();
  }
}

function handleLogout() {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("currentUser");
  updateAuthUI();
  showToast('Logged out successfully', 'info');
}

// ===== Focus Trap for Modals =====
function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusable.length === 0) return () => {};
  
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  
  const handler = e => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'Escape') {
      closeModal(modal);
    }
  };
  
  modal.addEventListener('keydown', handler);
  first.focus();
  
  return () => modal.removeEventListener('keydown', handler);
}

// ===== Modal Management =====
function isModalOpen() {
  return document.querySelector('.modal.open') !== null;
}

function openModal(modalId, setupCallback = null) {
  // Close any existing modal first
  if (activeModalTrap) {
    activeModalTrap();
    activeModalTrap = null;
  }
  
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  
  if (setupCallback) setupCallback(modal);
  
  activeModalTrap = trapFocus(modal);
}

function closeModal(modal) {
  if (typeof modal === 'string') {
    modal = document.getElementById(modal);
  }
  
  if (!modal) return;
  
  if (activeModalTrap) {
    activeModalTrap();
    activeModalTrap = null;
  }
  
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  
  // Clear form data based on modal type
  if (modal.id === 'eventModal') {
    eventForm?.reset();
    editingEvent = null;
  } else if (modal.id === 'detailsModal') {
    activeEventId = null;
  } else if (modal.id === 'loginModal') {
    authForm?.reset();
    if (authMessage) authMessage.textContent = "";
  } else if (modal.id === 'allEventsModal') {
    if (allEventsList) allEventsList.innerHTML = "";
  } else if (modal.id === 'profileSettingsModal') {
    profileForm?.reset();
  } else if (modal.id === 'accountSettingsModal') {
    accountForm?.reset();
  }
}

// Universal close button handler
document.querySelectorAll('.close-btn').forEach(btn => {
  btn.onclick = () => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  };
});

// Calendar title button - opens selector
const calendarTitleButton = document.getElementById('calendarTitleButton');
if (calendarTitleButton) {
  calendarTitleButton.onclick = () => {
    if (isModalOpen()) return;
    openCalendarSelectorModal();
  };
}

// ===== Event Modal =====
function openEventModal(date, event = null) {
  if (!currentUser) {
    showToast("Please log in to create/edit events", "warning");
    openModal('loginModal');
    return;
  }

  editingEvent = event;
  
  const modalTitle = document.getElementById('eventModalTitle');
  if (modalTitle) {
    modalTitle.textContent = event ? "Edit Event" : "Create Event";
  }
  
  eventForm?.reset();

  if (eventDateInput) {
    eventDateInput.value = date.toISOString().split('T')[0];
  }
  
  // Set calendar
  selectedCalendarId = selectedCalendarId || (allCalendars.owned[0]?._id);
  if (event) {
    selectedCalendarId = event.calendar?._id || event.calendar;
  }
  
  const calSelect = document.getElementById('eventCalendarSelect');
  if (calSelect) {
    calSelect.value = selectedCalendarId || '';
  }

  // Set time
  const smartTime = getSmartDefaultTime();
  let hour = smartTime.hour;
  let minute = smartTime.minute;

  if (event && !event.isAllDay && event.time) {
    [hour, minute] = event.time.split(":").map(Number);
  }

  if (!use24Hour && eventAMPMSelect) {
    eventAMPMSelect.value = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
  }
  
  if (eventHourInput) eventHourInput.value = hour;
  if (eventMinuteInput) eventMinuteInput.value = String(minute).padStart(2, "0");

  // Set end time
  let endHour = hour + 1;
  let endMinute = 0;
  
  if (event && event.endTime) {
    [endHour, endMinute] = event.endTime.split(":").map(Number);
  }
  
  if (!use24Hour && eventEndAMPMSelect) {
    eventEndAMPMSelect.value = endHour >= 12 ? "PM" : "AM";
    endHour = endHour % 12 || 12;
  }
  
  if (eventEndHourInput) eventEndHourInput.value = endHour;
  if (eventEndMinuteInput) eventEndMinuteInput.value = String(endMinute).padStart(2, "0");

  // Set checkboxes
  if (allDayCheckbox) allDayCheckbox.checked = event?.isAllDay || false;
  if (untilCheckbox) untilCheckbox.checked = !!event?.endTime;

  // Set form fields
  if (eventTitleInput) eventTitleInput.value = event?.title || "";
  if (eventDetailsInput) eventDetailsInput.value = event?.details || "";
  if (eventLocationInput) eventLocationInput.value = event?.location || "";
  if (eventColorPicker) eventColorPicker.value = event?.color || getRandomPastelColor();
  if (eventColorPreset) eventColorPreset.value = eventColorPicker.value;

  // Set recurrence
  if (recurrenceCheckbox) recurrenceCheckbox.checked = !!event?.recurrence;
  if (recurrenceFrequency) {
    recurrenceFrequency.value = event?.recurrence?.frequency || 'daily';
    recurrenceFrequency.disabled = !recurrenceCheckbox?.checked;
  }

  // Share with friends
  const shareSelect = document.getElementById('shareWithFriends');
  if (shareSelect && event?.shareWith) {
    Array.from(shareSelect.options).forEach(opt => {
      opt.selected = event.shareWith.includes(opt.value);
    });
  }

  updateTimeInputs();
  updateValidationState();

  openModal('eventModal');
}

// Open calendar selector modal
function openCalendarSelectorModal() {
  if (!currentUser) {
    showToast('Please log in first', 'warning');
    openModal('loginModal');
    return;
  }
  
  const modal = document.getElementById('calendarSelectorModal');
  const grid = document.getElementById('calendarSelectorGrid');
  
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Add owned calendars
  allCalendars.owned.forEach(cal => {
    const div = document.createElement('div');
    div.className = 'calendar-option' + (cal._id === selectedCalendarId ? ' selected' : '');
    div.innerHTML = `
      <div class="calendar-color-indicator" style="background: ${cal.color}"></div>
      <div class="calendar-name">${cal.name}</div>
    `;
    div.onclick = () => {
      selectedCalendarId = cal._id;
      updateCalendarTitle();
      eventCache.clear();
      updateView();
      closeModal(modal);
    };
    grid.appendChild(div);
  });
  
  // Add shared calendars
  allCalendars.shared.forEach(cal => {
    const div = document.createElement('div');
    div.className = 'calendar-option' + (cal._id === selectedCalendarId ? ' selected' : '');
    div.innerHTML = `
      <div class="calendar-color-indicator" style="background: ${cal.color}"></div>
      <div class="calendar-name">${cal.name} <small>(shared)</small></div>
    `;
    div.onclick = () => {
      selectedCalendarId = cal._id;
      updateCalendarTitle();
      eventCache.clear();
      updateView();
      closeModal(modal);
    };
    grid.appendChild(div);
  });
  
  openModal(modal);
}

// Update time input visibility
function updateTimeInputs() {
  const allDayDisabled = allDayCheckbox?.checked || false;
  const untilChecked = untilCheckbox?.checked || false;
  
  if (timeInputs) timeInputs.classList.toggle("hidden", allDayDisabled);
  if (untilContainer) untilContainer.classList.toggle("hidden", allDayDisabled);
  if (endTimeInputs) endTimeInputs.classList.toggle("hidden", allDayDisabled || !untilChecked);
  
  if (eventHourInput) eventHourInput.disabled = allDayDisabled;
  if (eventMinuteInput) eventMinuteInput.disabled = allDayDisabled;
  if (eventAMPMSelect) eventAMPMSelect.disabled = allDayDisabled || use24Hour;
  if (eventEndHourInput) eventEndHourInput.disabled = allDayDisabled || !untilChecked;
  if (eventEndMinuteInput) eventEndMinuteInput.disabled = allDayDisabled || !untilChecked;
  if (eventEndAMPMSelect) eventEndAMPMSelect.disabled = allDayDisabled || !untilChecked || use24Hour;
}

// ===== Profile Settings Modal =====
function openProfileSettingsModal() {
  if (!currentUser) return;
  
  if (displayName) displayName.value = currentUser.displayName || currentUser.username;
  if (profileBio) profileBio.value = currentUser.bio || "";
  
  if (currentUser.profileImage && currentProfileImage) {
    currentProfileImage.src = currentUser.profileImage;
    currentProfileImage.classList.remove("hidden");
  } else if (currentProfileImage) {
    currentProfileImage.classList.add("hidden");
  }
  
  openModal('profileSettingsModal');
}

// ===== Account Settings Modal =====
function openAccountSettingsModal() {
  if (!currentUser) return;
  
  if (accUsername) accUsername.value = currentUser.username;
  if (accEmail) accEmail.value = currentUser.email || "";
  if (accNewPassword) accNewPassword.value = "";
  
  openModal('accountSettingsModal');
}

// ===== Friends Modal =====
function openFriendsModal() {
  if (!currentUser) return;
  
  if (friendSearch) friendSearch.value = '';
  if (friendSearchResults) friendSearchResults.innerHTML = '';
  
  loadFriendRequests();
  renderFriendsList();
  
  openModal('friendsModal');
}

// Search users
if (searchFriendBtn) {
  searchFriendBtn.onclick = async () => {
    const query = friendSearch?.value.trim();
    if (!query) return;
    
    try {
      showLoading();
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const users = await res.json();
      
      if (!friendSearchResults) return;
      friendSearchResults.innerHTML = '';
      
      if (!users || users.length === 0) {
        friendSearchResults.innerHTML = '<p class="no-results">No users found.</p>';
        return;
      }
      
      users.forEach(u => {
        if (u.id === currentUser.id) return;
        
        const div = document.createElement('div');
        div.className = 'friend-item';
        
        const initials = (u.displayName || u.username)[0].toUpperCase();
        const avatarContent = u.profileImage 
          ? `<img src="${u.profileImage}" alt="">` 
          : initials;
        
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <div class="friend-avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width:32px; height:32px;">
              ${avatarContent}
            </div>
            <span>${u.username}${u.displayName ? ` (${u.displayName})` : ''}</span>
          </div>
          <button class="add-friend-btn small-btn">Add Friend</button>
        `;
        
        const addBtn = div.querySelector('.add-friend-btn');
        if (addBtn) {
          addBtn.onclick = async (e) => {
            e.stopPropagation();
            await sendFriendRequest(u.id);
            div.remove();
          };
        }
        
        friendSearchResults.appendChild(div);
      });
    } catch (e) {
      console.error('Search error:', e);
      if (friendSearchResults) {
        friendSearchResults.innerHTML = '<p class="error">Search failed.</p>';
      }
      showToast('Search failed', 'error');
    } finally {
      hideLoading();
    }
  };
}

// Send friend request
async function sendFriendRequest(toId) {
  try {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ to: toId })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || 'Request failed', 'error');
      return;
    }
    
    showToast('Friend request sent!', 'success');
    loadFriendRequests();
  } catch (e) {
    console.error(e);
    showToast('Failed to send request', 'error');
  }
}

// Load friend requests
async function loadFriendRequests() {
  if (!friendRequestsDiv) return;
  
  friendRequestsDiv.innerHTML = '<p style="text-align:center;color:#666;">Loading...</p>';
  
  try {
    // Fetch incoming requests
    const incomingRes = await fetch('/api/friends/requests/incoming', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    if (incomingRes.status === 401) {
      handleUnauthorized();
      return;
    }
    const incoming = await incomingRes.json();

    // Fetch outgoing requests
    const outgoingRes = await fetch('/api/friends/requests/outgoing', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    if (outgoingRes.status === 401) {
      handleUnauthorized();
      return;
    }
    const outgoing = await outgoingRes.json();

    friendRequestsDiv.innerHTML = '';

    // Render incoming requests
    if (incoming.length > 0) {
      const incomingHeader = document.createElement('h4');
      incomingHeader.textContent = 'Incoming Requests';
      incomingHeader.style.cssText = 'margin-top:0;margin-bottom:8px;font-size:13px;color:#5865f2;';
      friendRequestsDiv.appendChild(incomingHeader);

      incoming.forEach(r => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        const initials = (r.from.displayName || r.from.username)[0].toUpperCase();
        const avatarContent = r.from.profileImage 
          ? `<img src="${r.from.profileImage}" alt="">` 
          : initials;
        
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <div class="friend-avatar" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); width:32px; height:32px;">
              ${avatarContent}
            </div>
            <div>
              <div>${r.from.username}</div>
              <div style="font-size:11px;color:#666;">${r.from.bio || 'Wants to be friends'}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="accept-btn small-btn" style="background:#23a559;">Accept</button>
            <button class="reject-btn small-btn" style="background:#f23f42;">Reject</button>
          </div>
        `;
        
        const acceptBtn = div.querySelector('.accept-btn');
        const rejectBtn = div.querySelector('.reject-btn');
        
        if (acceptBtn) acceptBtn.onclick = () => handleFriendResponse(r._id, true);
        if (rejectBtn) rejectBtn.onclick = () => handleFriendResponse(r._id, false);
        
        friendRequestsDiv.appendChild(div);
      });
    }

    // Render outgoing requests
    if (outgoing.length > 0) {
      const outgoingHeader = document.createElement('h4');
      outgoingHeader.textContent = 'Sent Requests';
      outgoingHeader.style.cssText = `margin-top:${incoming.length > 0 ? '16px' : '0'};margin-bottom:8px;font-size:13px;color:#666;`;
      friendRequestsDiv.appendChild(outgoingHeader);

      outgoing.forEach(r => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        const initials = (r.to.displayName || r.to.username)[0].toUpperCase();
        const avatarContent = r.to.profileImage 
          ? `<img src="${r.to.profileImage}" alt="">` 
          : initials;
        
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <div class="friend-avatar" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); width:32px; height:32px;">
              ${avatarContent}
            </div>
            <div>
              <div>${r.to.username}</div>
              <div style="font-size:11px;color:#666;">Pending...</div>
            </div>
          </div>
          <button class="cancel-btn small-btn" style="background:#4e5058;">Cancel</button>
        `;
        
        const cancelBtn = div.querySelector('.cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => cancelFriendRequest(r._id);
        
        friendRequestsDiv.appendChild(div);
      });
    }

    // Show empty state
    if (incoming.length === 0 && outgoing.length === 0) {
      friendRequestsDiv.innerHTML = '<p style="text-align:center;color:#666;font-style:italic;padding:12px;">No pending requests</p>';
    }
  } catch (e) {
    console.error(e);
    if (friendRequestsDiv) {
      friendRequestsDiv.innerHTML = '<p style="text-align:center;color:#f23f42;">Failed to load requests</p>';
    }
    showToast('Failed to load friend requests', 'error');
  }
}

// Handle friend request response
async function handleFriendResponse(reqId, accept) {
  try {
    const res = await fetch(`/api/friends/requests/${reqId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ accept })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Response failed');
    
    showToast(accept ? 'Friend request accepted!' : 'Friend request rejected', 'success');
    loadFriendRequests();
    renderFriendsList();
  } catch (e) {
    console.error(e);
    showToast('Action failed', 'error');
  }
}

// Cancel friend request
async function cancelFriendRequest(reqId) {
  try {
    const res = await fetch(`/api/friends/requests/outgoing/${reqId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Cancel failed');
    
    showToast('Request cancelled', 'info');
    loadFriendRequests();
  } catch (e) {
    console.error(e);
    showToast('Failed to cancel', 'error');
  }
}

// Render friends list
async function renderFriendsList() {
  try {
    const res = await fetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    const friends = await res.json();
    
    // Update modal friends list
    if (friendsListDiv) {
      friendsListDiv.innerHTML = '';
      
      if (friends.length === 0) {
        friendsListDiv.innerHTML = '<p style="text-align:center;color:#666;font-style:italic;padding:12px;">No friends yet</p>';
      } else {
        friends.forEach(f => {
          const div = document.createElement('div');
          div.className = 'friend-item';
          
          const initials = (f.displayName || f.username)[0].toUpperCase();
          const avatarContent = f.profileImage 
            ? `<img src="${f.profileImage}" alt="">` 
            : initials;
          
          div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer;">
              <div class="friend-avatar">
                ${avatarContent}
              </div>
              <span>${f.username}${f.displayName ? ` (${f.displayName})` : ''}</span>
            </div>
            <button class="remove-friend-btn small-btn" style="background:#f44336;">Remove</button>
          `;
          
          // Click to view profile
          const infoSection = div.querySelector('div[style*="cursor:pointer"]');
          if (infoSection) {
            infoSection.onclick = () => openFriendProfileModal(f);
          }
          
          const removeBtn = div.querySelector('.remove-friend-btn');
          if (removeBtn) {
            removeBtn.onclick = async (e) => {
              e.stopPropagation();
              if (!confirm(`Remove ${f.username} from your friends?`)) return;
              
              try {
                const res = await fetch(`/api/friends/${f.id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${jwtToken}` }
                });
                
                if (res.ok) {
                  showToast('Friend removed', 'info');
                  renderFriendsList();
                  renderFriendsSidebar();
                }
              } catch (err) {
                showToast('Failed to remove friend', 'error');
              }
            };
          }
          
          friendsListDiv.appendChild(div);
        });
      }
    }
    
    populateShareSelect(friends);
    renderFriendsSidebar(friends);
  } catch (e) {
    console.error(e);
    showToast('Failed to load friends', 'error');
  }
}

// Render friends sidebar
async function renderFriendsSidebar(friends = null) {
  const container = document.getElementById('friendsListSidebar');
  if (!container) return;
  
  if (!currentUser) {
    container.innerHTML = '<div class="no-friends"><p style="padding:20px;text-align:center;color:#666;">Log in to see friends</p></div>';
    return;
  }

  // Fetch if not provided
  if (!friends) {
    try {
      const res = await fetch('/api/friends', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      friends = await res.json();
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="no-friends"><p style="padding:20px;text-align:center;color:#666;">Failed to load</p></div>';
      return;
    }
  }

  if (friends.length === 0) {
    container.innerHTML = `
      <div class="no-friends">
        <svg class="no-friends-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
        <h4>No friends yet</h4>
        <p>Add friends to see them here. Send requests from Manage Friends.</p>
        <button class="add-friends-btn" onclick="openFriendsModal()">Add Friends</button>
      </div>
    `;
    return;
  }

  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ];

  container.innerHTML = friends.map(friend => {
    const initials = (friend.displayName || friend.username).split(' ')
      .map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const gradient = colors[Math.abs((friend.id || friend._id).charCodeAt(0)) % colors.length];
    const avatarContent = friend.profileImage 
      ? `<img src="${friend.profileImage}" alt="${friend.username}">` 
      : initials;

    return `
      <div class="friend-sidebar-item" data-friend-id="${friend.id || friend._id}">
        <div class="friend-avatar" style="background: ${gradient}">
          ${avatarContent}
          <div class="friend-status"></div>
        </div>
        <div class="friend-info">
          <div class="friend-name">${friend.displayName || friend.username}</div>
          <div class="friend-status-text">${friend.bio || 'Online'}</div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.friend-sidebar-item').forEach(item => {
    item.onclick = () => {
      const friendId = item.dataset.friendId;
      const friend = friends.find(f => (f.id || f._id) === friendId);
      if (friend) openFriendProfileModal(friend);
    };
  });
}

// Open friend profile modal
function openFriendProfileModal(friend) {
  const modal = document.getElementById('friendProfileModal');
  const title = document.getElementById('friendProfileTitle');
  const displayNameEl = document.getElementById('friendDisplayName');
  const bioEl = document.getElementById('friendBio');
  const img = document.getElementById('friendProfileImage');
  
  if (title) title.textContent = friend.displayName || friend.username;
  if (displayNameEl) displayNameEl.textContent = friend.displayName || friend.username;
  if (bioEl) bioEl.textContent = friend.bio || 'No bio yet';
  
  if (img) {
    if (friend.profileImage) {
      img.src = friend.profileImage;
      img.classList.remove('hidden');
    } else {
      img.classList.add('hidden');
    }
  }
  
  openModal(modal);
}

// Populate share-with-friends select
function populateShareSelect(friends) {
  const shareSelect = document.getElementById('shareWithFriends');
  if (!shareSelect) return;
  
  shareSelect.innerHTML = '';
  friends.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.username;
    shareSelect.appendChild(opt);
  });
}

// ===== Event Details Modal =====
function openDetailsModal(event) {
  activeEventId = event.id;
  
  if (detailsContent) {
    const calendarInfo = (() => {
      const cal = allCalendars.owned.find(c => c._id === (event.calendar?._id || event.calendar)) ||
                  allCalendars.shared.find(c => c._id === (event.calendar?._id || event.calendar));
      return cal ? `<p><strong>Calendar:</strong> ${cal.name}</p>` : '';
    })();
    
    // Build completion status (NEW)
    const completionStatus = event.completed 
      ? `<p><strong>Status:</strong> <span style="color: #4caf50;">✓ Completed</span></p>`
      : `<p><strong>Status:</strong> <span style="color: #666;">Pending</span></p>`;
    
    // Show points info (NEW)
    const pointsInfo = event.pointsAwarded > 0
      ? `<p><strong>Points Earned:</strong> <span class="points-badge">+${event.pointsAwarded}</span></p>`
      : '';
    
    detailsContent.innerHTML = `
      <p><strong>Title:</strong> ${event.displayTitle || event.title}</p>
      <p><strong>Date:</strong> ${event.date}</p>
      <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
      ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
      ${event.details ? `<p><strong>Details:</strong> ${event.details}</p>` : ''}
      ${calendarInfo}
      ${event.recurrence ? `<p><strong>Recurrence:</strong> ${event.recurrence.frequency}</p>` : ''}
      ${event.isInstance ? '<p><em>(Recurring instance)</em></p>' : ''}
      ${completionStatus}
      ${pointsInfo}
    `;
  }
  
  openModal('detailsModal');
}

// ===== All Events Modal =====
function openAllEventsModal() {
  if (!currentUser) {
    showToast("Please log in to view events", "warning");
    openModal('loginModal');
    return;
  }
  
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = parseDateOnly(a.date);
    const dateB = parseDateOnly(b.date);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });

  if (allEventsList) {
    allEventsList.innerHTML = "";
    
    if (sortedEvents.length === 0) {
      allEventsList.innerHTML = "<p style='text-align:center;padding:20px;color:#666;'>No events found.</p>";
    } else {
      sortedEvents.forEach(event => {
        const eventItem = document.createElement("div");
        eventItem.className = "all-event-item";
        if (event.completed) eventItem.classList.add("event-completed");
        eventItem.tabIndex = 0;
        
        const summary = document.createElement('div');
        summary.className = 'event-summary';
        summary.style.display = 'flex';
        summary.style.alignItems = 'flex-start';
        summary.style.gap = '10px';
        
        // Add checkbox (NEW)
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "event-checkbox";
        checkbox.checked = event.completed || false;
        checkbox.onclick = (e) => {
          e.stopPropagation();
          if (checkbox.checked) {
            markEventComplete(event.id, checkbox);
          } else {
            markEventUncomplete(event.id, checkbox);
          }
        };
        summary.appendChild(checkbox);
        
        const contentDiv = document.createElement('div');
        contentDiv.style.flex = '1';
        
        const titleDiv = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = event.title;
        titleDiv.appendChild(title);
        
        // Add points badge if awarded (NEW)
        if (event.pointsAwarded > 0) {
          const badge = document.createElement('span');
          badge.className = 'points-badge';
          badge.textContent = `+${event.pointsAwarded}`;
          badge.style.marginLeft = '8px';
          titleDiv.appendChild(badge);
        }
        
        contentDiv.appendChild(titleDiv);
        
        const dateTime = document.createElement('p');
        dateTime.textContent = `${event.date} ${formatTimeForDisplay(event)}`;
        dateTime.style.margin = '4px 0';
        contentDiv.appendChild(dateTime);
        
        if (event.details) {
          const details = document.createElement('p');
          details.textContent = event.details;
          details.style.margin = '4px 0';
          contentDiv.appendChild(details);
        }
        
        if (event.location) {
          const location = document.createElement('p');
          const locLabel = document.createElement('strong');
          locLabel.textContent = 'Location: ';
          location.appendChild(locLabel);
          location.appendChild(document.createTextNode(event.location));
          location.style.margin = '4px 0';
          contentDiv.appendChild(location);
        }
        
        if (event.recurrence) {
          const recur = document.createElement('p');
          recur.innerHTML = `<em>Repeats ${event.recurrence.frequency}</em>`;
          recur.style.margin = '4px 0';
          contentDiv.appendChild(recur);
        }
        
        summary.appendChild(contentDiv);
        
        const actions = document.createElement('div');
        actions.className = 'event-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn small-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          closeModal('allEventsModal');
          openEventModal(parseDateOnly(event.date), event);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn small-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${event.title}"?`)) {
            try {
              showLoading();
              const response = await fetch(`/api/events/${event.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${jwtToken}` },
              });
              
              if (response.status === 401) {
                handleUnauthorized();
                return;
              }
              
              if (!response.ok) throw new Error('Failed to delete event');
              
              events = events.filter(e => e.id !== event.id);
              eventCache.clear();
              showToast('Event deleted successfully', 'success');
              openAllEventsModal();
              updateView();
              
              // Reload leaderboard in case it affects rankings
              loadLeaderboard();
            } catch (err) {
              console.error("Delete error:", err);
              showToast("Error deleting event", "error");
            } finally {
              hideLoading();
            }
          }
        };
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        eventItem.appendChild(summary);
        eventItem.appendChild(actions);
        
        eventItem.onclick = (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
          openDetailsModal(event);
        };
        
        allEventsList.appendChild(eventItem);
      });
    }
  }
  
  openModal('allEventsModal');
}

// ===== Calendar Management =====

// Load calendars
async function loadCalendars() {
  if (!currentUser) return;
  
  try {
    const res = await fetch('/api/calendars', { 
      headers: { Authorization: `Bearer ${jwtToken}` } 
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Failed to load calendars');
    
    const data = await res.json();
    allCalendars = data;
    
    // Initialize visible calendars if empty
    if (window.visibleCalendars.size === 0 && allCalendars.owned.length > 0) {
      allCalendars.owned.forEach(cal => window.visibleCalendars.add(cal._id));
      allCalendars.shared.forEach(cal => window.visibleCalendars.add(cal._id));
      saveVisibleCalendars();
    }
    
    renderCalendarSelect();
    renderCalendarsList();
    
    // Set default selected calendar
    if (!selectedCalendarId && allCalendars.owned.length > 0) {
      selectedCalendarId = allCalendars.owned[0]._id;
    }
    updateCalendarTitle();
  } catch (e) {
    console.error('Failed to load calendars:', e);
    showToast('Failed to load calendars', 'error');
  }
}

// Render calendar select dropdown
function renderCalendarSelect() {
  const sel = document.getElementById('eventCalendarSelect');
  if (!sel) return;
  
  sel.innerHTML = '';
  
  if (allCalendars.owned.length === 0) {
    const opt = new Option('Create a calendar first', '', true, true);
    opt.disabled = true;
    sel.add(opt);
    const calSelector = document.getElementById('calendarSelector');
    if (calSelector) calSelector.classList.remove('hidden');
    return;
  }
  
  allCalendars.owned.forEach(c => {
    const opt = new Option(c.name, c._id, false, selectedCalendarId === c._id);
    sel.add(opt);
  });
  
  allCalendars.shared.forEach(c => {
    const opt = new Option(`${c.name} (shared)`, c._id, false, selectedCalendarId === c._id);
    opt.disabled = true;
    sel.add(opt);
  });
  
  const calSelector = document.getElementById('calendarSelector');
  if (calSelector) {
    calSelector.classList.toggle('hidden', allCalendars.owned.length === 0);
  }
}

// Render calendars list in management modal
function renderCalendarsList() {
  if (!calendarsList) return;
  
  calendarsList.innerHTML = '';
  
  if (allCalendars.owned.length > 0) {
    const myHeader = document.createElement('h3');
    myHeader.textContent = 'My Calendars';
    myHeader.style.cssText = 'margin-top:0;margin-bottom:12px;font-size:14px;font-weight:600;';
    calendarsList.appendChild(myHeader);
    
    allCalendars.owned.forEach(cal => {
      const item = createCalendarListItem(cal, true);
      calendarsList.appendChild(item);
    });
  }
  
  if (allCalendars.shared.length > 0) {
    const sharedHeader = document.createElement('h3');
    sharedHeader.textContent = 'Shared With Me';
    sharedHeader.style.cssText = 'margin-top:20px;margin-bottom:12px;font-size:14px;font-weight:600;';
    calendarsList.appendChild(sharedHeader);
    
    allCalendars.shared.forEach(cal => {
      const item = createCalendarListItem(cal, false);
      calendarsList.appendChild(item);
    });
  }
  
  if (allCalendars.owned.length === 0 && allCalendars.shared.length === 0) {
    calendarsList.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">No calendars yet. Create your first calendar!</p>';
  }
}

// Create calendar list item
function createCalendarListItem(cal, isOwned) {
  const item = document.createElement('div');
  item.className = 'calendar-list-item';
  
  const isVisible = window.visibleCalendars.has(cal._id);
  
  item.innerHTML = `
    <button class="visibility-btn" data-cal-id="${cal._id}" style="background:none;border:none;cursor:pointer;padding:4px;" aria-label="Toggle visibility">
      ${isVisible ? '👁️' : '👁️‍🗨️'}
    </button>
    <div class="calendar-dot" style="background: ${cal.color}"></div>
    <div class="calendar-info" style="flex:1;">
      <div class="calendar-name">${cal.name}</div>
      ${cal.owner && cal.owner.username ? `<div class="calendar-count">by ${cal.owner.username}</div>` : ''}
    </div>
    ${isOwned ? `
      <button class="edit-cal-btn small-btn" data-cal-id="${cal._id}">Edit</button>
      <button class="share-cal-btn small-btn" data-cal-id="${cal._id}">Share</button>
    ` : '<span style="font-size:12px;color:#999;">View only</span>'}
  `;
  
  const visBtn = item.querySelector('.visibility-btn');
  if (visBtn) {
    visBtn.onclick = (e) => {
      e.stopPropagation();
      toggleCalendarVisibility(cal._id);
    };
  }
  
  const editBtn = item.querySelector('.edit-cal-btn');
  if (editBtn) {
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openCalendarFormModal(cal);
    };
  }
  
  const shareBtn = item.querySelector('.share-cal-btn');
  if (shareBtn) {
    shareBtn.onclick = (e) => {
      e.stopPropagation();
      openShareCalendarModal(cal);
    };
  }

  const closeShareModalBtn = document.getElementById('closeShareModal');
  if (closeShareModalBtn) {
    closeShareModalBtn.onclick = () => {
      closeModal('shareCalendarModal');
    };
  }
  
  return item;
}

// Toggle calendar visibility
function toggleCalendarVisibility(calId) {
  if (window.visibleCalendars.has(calId)) {
    window.visibleCalendars.delete(calId);
  } else {
    window.visibleCalendars.add(calId);
  }
  saveVisibleCalendars();
  renderCalendarsList();
  eventCache.clear();
  updateView();
}

// Open calendar management modal
function openCalendarModal() {
  if (!currentUser) {
    showToast('Please log in first', 'warning');
    openModal('loginModal');
    return;
  }
  
  loadCalendars();
  openModal('calendarModal');
}

// Open calendar form modal
function openCalendarFormModal(calendar = null) {
  editingCalendarId = calendar?._id || null;
  
  if (calendarFormTitle) {
    calendarFormTitle.textContent = calendar ? 'Edit Calendar' : 'Create Calendar';
  }
  
  if (calendarNameInput) calendarNameInput.value = calendar?.name || '';
  if (calendarColorInput) calendarColorInput.value = calendar?.color || '#3788d8';
  if (calendarDescriptionInput) calendarDescriptionInput.value = calendar?.description || '';
  
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === calendarColorInput?.value);
  });
  
  if (deleteCalendarBtn) {
    deleteCalendarBtn.classList.toggle('hidden', !calendar);
  }
  
  openModal('calendarFormModal', () => {
    if (calendarNameInput) calendarNameInput.focus();
  });
}

// Create calendar
async function createCalendarAPI(name, color, description) {
  try {
    showLoading();
    const res = await fetch('/api/calendars', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ name, color, description })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return null;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create calendar');
    }
    
    const newCal = await res.json();
    showToast('Calendar created successfully', 'success');
    return newCal;
  } catch (e) {
    console.error('Create calendar error:', e);
    showToast(e.message, 'error');
    return null;
  } finally {
    hideLoading();
  }
}

// Update calendar
async function updateCalendarAPI(calId, name, color, description) {
  try {
    showLoading();
    const res = await fetch(`/api/calendars/${calId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ name, color, description })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return null;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update calendar');
    }
    
    const updated = await res.json();
    showToast('Calendar updated successfully', 'success');
    return updated;
  } catch (e) {
    console.error('Update calendar error:', e);
    showToast(e.message, 'error');
    return null;
  } finally {
    hideLoading();
  }
}

// Delete calendar
async function deleteCalendarAPI(calId) {
  if (!confirm('Delete this calendar? All events will be removed.')) return;
  
  try {
    showLoading();
    const res = await fetch(`/api/calendars/${calId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete calendar');
    }
    
    window.visibleCalendars.delete(calId);
    saveVisibleCalendars();
    
    showToast('Calendar deleted successfully', 'success');
    await loadCalendars();
    closeModal('calendarFormModal');
    fetchEvents();
  } catch (e) {
    console.error('Delete calendar error:', e);
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// Share calendar modal
function openShareCalendarModal(calendar) {
  const friendId = prompt(`Enter friend's user ID to share "${calendar.name}" with:`);
  if (!friendId) return;
  shareCalendarAPI(calendar._id, friendId);
}

// Share calendar API
async function shareCalendarAPI(calId, userId) {
  try {
    showLoading();
    const res = await fetch(`/api/calendars/${calId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ userId, permission: 'view' })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to share calendar');
    }
    
    showToast('Calendar shared successfully!', 'success');
    loadCalendars();
  } catch (e) {
    console.error('Share calendar error:', e);
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ===== Calendar Views =====

// Render mini calendar
function renderMiniCalendar(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  if (monthYear) {
    monthYear.textContent = date.toLocaleDateString("default", { 
      month: "long", 
      year: "numeric" 
    });
  }
  
  if (calendarBody) calendarBody.innerHTML = "";
  
  let row = document.createElement("tr");
  
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    row.appendChild(document.createElement("td"));
  }
  
  // Days of the month
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.textContent = day;
    cell.tabIndex = 0;
    
    const cellDate = new Date(year, month, day);
    
    if (cellDate.toDateString() === new Date().toDateString()) {
      cell.classList.add("today");
    }
    
    if (cellDate.toDateString() === selectedDate.toDateString()) {
      cell.classList.add("selected");
    }
    
    cell.setAttribute("aria-label", `Day ${day} of ${monthYear?.textContent || ''}`);
    
    const handleSelectDate = () => {
      if (isModalOpen()) return;
      selectedDate = cellDate;
      currentView = "month";
      updateView();
    };
    
    cell.onclick = handleSelectDate;
    cell.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelectDate();
      }
    };
    
    row.appendChild(cell);
    
    if ((firstDay + day) % 7 === 0 || day === totalDays) {
      if (calendarBody) calendarBody.appendChild(row);
      row = document.createElement("tr");
    }
  }
}

// Render month view
function renderMonthView() {
  console.log('Rendering month view for:', selectedDate);
  
  if (monthTitle) {
    monthTitle.textContent = selectedDate.toLocaleDateString("default", { 
      month: "long", 
      year: "numeric" 
    });
  }
  
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  if (bigCalendarBody) bigCalendarBody.innerHTML = "";
  
  let row = document.createElement("tr");
  
  for (let i = 0; i < firstDay; i++) {
    row.appendChild(document.createElement("td"));
  }
  
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.tabIndex = 0;
    const cellDate = new Date(year, month, day);
    cell.textContent = day;
    
    if (cellDate.toDateString() === selectedDate.toDateString()) {
      cell.classList.add("selected");
    }
    
    cell.setAttribute("aria-label", `Day ${day} of ${monthTitle?.textContent || ''}`);
    
    const handleCellClick = () => {
      if (isModalOpen()) return;
      if (currentUser) {
        selectedDate = cellDate;
        syncMiniCalendar();
        openEventModal(cellDate);
      } else {
        showToast("Please log in to create events", "warning");
        openModal('loginModal');
      }
    };
    
    cell.onclick = handleCellClick;
    cell.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCellClick();
      }
    };
    
    const dayEvents = getEventsForDate(cellDate);
    
    dayEvents.slice(0, 3).forEach(event => {
      const div = document.createElement("div");
      div.classList.add("month-event");
      
      // Add completed class if event is completed (NEW)
      if (event.completed) {
        div.classList.add("event-completed");
      }
      
      const calendar = allCalendars.owned.find(c => c._id === (event.calendar?._id || event.calendar)) || 
                       allCalendars.shared.find(c => c._id === (event.calendar?._id || event.calendar));
      
      if (calendar?.color) div.style.backgroundColor = calendar.color;
      else if (event.color) div.style.backgroundColor = event.color;
      
      div.tabIndex = 0;
      
      if (event.isAllDay) div.classList.add("all-day");
      if (event.isInstance) div.style.opacity = '0.7';
      
      // Add checkbox for task completion (NEW)
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "event-checkbox";
      checkbox.checked = event.completed || false;
      checkbox.onclick = (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          markEventComplete(event.id, checkbox);
        } else {
          markEventUncomplete(event.id, checkbox);
        }
      };
      
      const eventText = document.createElement("span");
      eventText.textContent = event.displayTitle || `${event.title} (${formatTimeForDisplay(event)})`;
      
      div.appendChild(checkbox);
      div.appendChild(eventText);
      
      // Add points badge if awarded (NEW)
      if (event.pointsAwarded > 0) {
        const badge = document.createElement("span");
        badge.className = "points-badge";
        badge.textContent = `+${event.pointsAwarded}`;
        div.appendChild(badge);
      }
      
      div.setAttribute("aria-label", `Event: ${event.title} on ${event.date} at ${formatTimeForDisplay(event)}`);
      
      const handleEventClick = e => {
        e.stopPropagation();
        if (isModalOpen()) return;
        openDetailsModal(event);
      };
      
      div.onclick = handleEventClick;
      div.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      };
      
      cell.appendChild(div);
    });
    
    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.classList.add("more-events");
      more.tabIndex = 0;
      more.textContent = `+${dayEvents.length - 3} more`;
      
      const handleMoreClick = () => {
        if (isModalOpen()) return;
        selectedDate = cellDate;
        currentView = "week";
        updateView();
      };
      
      more.onclick = handleMoreClick;
      more.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleMoreClick();
        }
      };
      
      cell.appendChild(more);
    }
    
    row.appendChild(cell);
    
    if ((firstDay + day) % 7 === 0 || day === totalDays) {
      if (bigCalendarBody) bigCalendarBody.appendChild(row);
      row = document.createElement("tr");
    }
  }
}

// Render week view
function renderWeekView() {
  console.log('Rendering week view for:', selectedDate);
  
  if (!weekView) return;
  
  let weekNav = weekView.querySelector(".week-nav");
  if (!weekNav) {
    weekNav = document.createElement("div");
    weekNav.classList.add("week-nav");
    weekNav.innerHTML = `
      <button id="prevWeek" aria-label="Previous Week">&lt;</button>
      <h2 id="weekTitle"></h2>
      <button id="nextWeek" aria-label="Next Week">&gt;</button>
    `;
    weekView.prepend(weekNav);
  }
  
  const prevWeek = weekNav.querySelector("#prevWeek");
  const nextWeek = weekNav.querySelector("#nextWeek");
  
  if (prevWeek) {
    prevWeek.onclick = () => {
      selectedDate.setDate(selectedDate.getDate() - 7);
      syncMiniCalendar();
      updateView();
    };
  }
  
  if (nextWeek) {
    nextWeek.onclick = () => {
      selectedDate.setDate(selectedDate.getDate() + 7);
      syncMiniCalendar();
      updateView();
    };
  }
  
  const weekTitle = weekNav.querySelector("#weekTitle");
  let gridContainer = weekView.querySelector(".week-grid-container");
  
  if (!gridContainer) {
    gridContainer = document.createElement("div");
    gridContainer.classList.add("week-grid-container");
    weekView.appendChild(gridContainer);
  } else {
    gridContainer.innerHTML = "";
  }

  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  
  const isSmallScreen = window.matchMedia("(max-width: 480px)").matches;
  const daysToShow = isSmallScreen ? 3 : 7;
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + daysToShow - 1);
  
  if (weekTitle) {
    weekTitle.textContent = `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  // Time column
  const timeCol = document.createElement("div");
  timeCol.classList.add("time-column");
  
  for (let h = 0; h < 24; h++) {
    const div = document.createElement("div");
    if (use24Hour) {
      div.textContent = `${h}:00`;
    } else {
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? "PM" : "AM";
      div.textContent = `${hour12}:00 ${ampm}`;
    }
    timeCol.appendChild(div);
  }
  
  gridContainer.appendChild(timeCol);

  // Day columns
  for (let d = 0; d < daysToShow; d++) {
    const col = document.createElement("div");
    col.classList.add("day-column");
    
    const header = document.createElement("div");
    header.classList.add("day-header");
    
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + d);
    
    header.textContent = dayDate.toLocaleDateString("default", { 
      weekday: "short", 
      month: "short", 
      day: "numeric" 
    });
    
    col.appendChild(header);
    
    const allDayContainer = document.createElement("div");
    allDayContainer.classList.add("all-day-container");
    col.appendChild(allDayContainer);
    
    const slots = document.createElement("div");
    slots.classList.add("day-slots");
    
    for (let h = 0; h < 24; h++) {
      const slot = document.createElement("div");
      slot.classList.add("hour-slot");
      slot.tabIndex = 0;
      
      const handleSlotClick = () => {
        if (isModalOpen()) return;
        if (currentUser) {
          selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
          syncMiniCalendar();
          openEventModal(selectedDate);
        } else {
          showToast("Please log in to create events", "warning");
          openModal('loginModal');
        }
      };
      
      slot.onclick = handleSlotClick;
      slot.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSlotClick();
        }
      };
      
      slots.appendChild(slot);
    }
    
    col.appendChild(slots);
    
    const dayEvents = getEventsForDate(dayDate);
    
    // All-day events (WITH CHECKBOX - NEW)
    dayEvents.filter(e => e.isAllDay).forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("all-day-event");
      evBox.tabIndex = 0;
      
      if (event.completed) evBox.classList.add("event-completed");
      if (event.isInstance) evBox.style.opacity = '0.7';
      if (event.color) evBox.style.backgroundColor = event.color;
      
      // Add checkbox (NEW)
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "event-checkbox";
      checkbox.checked = event.completed || false;
      checkbox.onclick = (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          markEventComplete(event.id, checkbox);
        } else {
          markEventUncomplete(event.id, checkbox);
        }
      };
      
      evBox.appendChild(checkbox);
      
      const textSpan = document.createElement("span");
      textSpan.textContent = event.displayTitle || event.title;
      evBox.appendChild(textSpan);
      
      if (event.pointsAwarded > 0) {
        const badge = document.createElement("span");
        badge.className = "points-badge";
        badge.textContent = `+${event.pointsAwarded}`;
        evBox.appendChild(badge);
      }
      
      const handleEventClick = e => {
        e.stopPropagation();
        if (isModalOpen()) return;
        openDetailsModal(event);
      };
      
      evBox.onclick = handleEventClick;
      evBox.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      };
      
      allDayContainer.appendChild(evBox);
    });
    
    // Timed events with overlap detection
    const timedEvents = dayEvents.filter(e => !e.isAllDay);
    const overlaps = timedEvents.map(event => ({
      event,
      startMin: getTimeInMinutes(event.time || "00:00"),
      endMin: getTimeInMinutes(event.endTime || (event.time ? `${parseInt(event.time.split(":")[0]) + 1}:00` : "01:00")),
    }));
    
    const lanes = [];
    overlaps.forEach(item => {
      let placed = false;
      for (let lane of lanes) {
        if (!lane.some(other => item.startMin < other.endMin && item.endMin > other.startMin)) {
          lane.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([item]);
    });
    
    const hourSlotHeight = isSmallScreen ? 50 : 60;
    const headerHeight = 30;
    const allDayContainerHeight = allDayContainer.children.length ? 30 : 0;
    
    timedEvents.forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("event-box");
      evBox.tabIndex = 0;
      
      if (event.completed) evBox.classList.add("event-completed");
      if (event.isInstance) evBox.style.opacity = '0.7';
      if (event.color) {
        evBox.style.backgroundColor = event.color;
      } else {
        evBox.style.backgroundColor = document.body.classList.contains("dark-mode") 
          ? "var(--event-box-dark-bg)" 
          : "var(--event-box-bg)";
      }
      
      // Add checkbox (NEW)
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "event-checkbox";
      checkbox.checked = event.completed || false;
      checkbox.onclick = (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          markEventComplete(event.id, checkbox);
        } else {
          markEventUncomplete(event.id, checkbox);
        }
      };
      
      evBox.appendChild(checkbox);
      
      const textSpan = document.createElement("span");
      textSpan.textContent = event.displayTitle || `${event.title} (${formatTimeForDisplay(event)})`;
      evBox.appendChild(textSpan);
      
      if (event.pointsAwarded > 0) {
        const badge = document.createElement("span");
        badge.className = "points-badge";
        badge.textContent = `+${event.pointsAwarded}`;
        evBox.appendChild(badge);
      }
      
      const startMin = getTimeInMinutes(event.time || "00:00");
      const endMin = getTimeInMinutes(event.endTime || (event.time ? `${parseInt(event.time.split(":")[0]) + 1}:00` : "01:00"));
      
      const laneIndex = lanes.findIndex(lane => lane.some(item => item.event === event));
      const laneWidth = 100 / Math.max(1, lanes.length);
      
      evBox.style.width = `calc(${laneWidth}% - 10px)`;
      evBox.style.left = `calc(${laneIndex * laneWidth}% + 5px)`;
      evBox.style.top = `${headerHeight + allDayContainerHeight + (startMin / 60) * hourSlotHeight}px`;
      evBox.style.height = `${((endMin - startMin) / 60) * hourSlotHeight - 4}px`;
      
      const handleEventClick = e => {
        e.stopPropagation();
        if (isModalOpen()) return;
        openDetailsModal(event);
      };
      
      evBox.onclick = handleEventClick;
      evBox.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      };
      
      col.appendChild(evBox);
    });
    
    gridContainer.appendChild(col);
  }

  // Auto-scroll to current time
  const now = new Date();
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekEnd);
  
  if (now >= weekStartDate && now <= weekEndDate) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const scrollPosition = (currentHour + currentMinute / 60) * (isSmallScreen ? 50 : 60);
    gridContainer.scrollTop = scrollPosition - ((isSmallScreen ? 50 : 60) * 2);
  } else {
    gridContainer.scrollTop = 7 * (isSmallScreen ? 50 : 60);
  }
}

// Render year view
function renderYearView() {
  console.log('Rendering year view for:', selectedDate.getFullYear());
  
  if (yearTitle) {
    yearTitle.textContent = selectedDate.getFullYear();
  }
  
  if (!yearGrid) return;
  yearGrid.innerHTML = "";
  
  for (let m = 0; m < 12; m++) {
    const monthDiv = document.createElement("div");
    monthDiv.classList.add("year-month");
    
    const monthHeader = document.createElement("h3");
    monthHeader.textContent = new Date(selectedDate.getFullYear(), m, 1).toLocaleDateString("default", { month: "long" });
    monthDiv.appendChild(monthHeader);
    
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach(day => {
      const th = document.createElement("th");
      th.textContent = day;
      tr.appendChild(th);
    });
    
    thead.appendChild(tr);
    table.appendChild(thead);
    
    const tbody = document.createElement("tbody");
    const firstDay = new Date(selectedDate.getFullYear(), m, 1).getDay();
    const totalDays = new Date(selectedDate.getFullYear(), m + 1, 0).getDate();
    
    let row = document.createElement("tr");
    
    for (let i = 0; i < firstDay; i++) {
      row.appendChild(document.createElement("td"));
    }
    
    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement("td");
      cell.textContent = day;
      cell.tabIndex = 0;
      
      const cellDate = new Date(selectedDate.getFullYear(), m, day);
      
      if (cellDate.toDateString() === new Date().toDateString()) {
        cell.classList.add("today");
      }
      
      if (cellDate.toDateString() === selectedDate.toDateString()) {
        cell.classList.add("selected");
      }
      
      const dayEvents = getEventsForDate(cellDate);
      if (dayEvents.length) {
        cell.classList.add("has-events");
      }
      
      const handleCellClick = () => {
        if (isModalOpen()) return;
        selectedDate = cellDate;
        currentView = "month";
        updateView();
      };
      
      cell.onclick = handleCellClick;
      cell.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCellClick();
        }
      };
      
      row.appendChild(cell);
      
      if ((firstDay + day) % 7 === 0 || day === totalDays) {
        tbody.appendChild(row);
        row = document.createElement("tr");
      }
    }
    
    table.appendChild(tbody);
    monthDiv.appendChild(table);
    yearGrid.appendChild(monthDiv);
  }
}

// Update view
function updateView() {
  eventCache.clear();
  console.log('Updating view:', currentView);
  
  if (monthView) monthView.classList.add("hidden");
  if (weekView) weekView.classList.add("hidden");
  if (yearView) yearView.classList.add("hidden");
  
  document.querySelectorAll(".view-btn").forEach(btn => btn.classList.remove("active"));
  
  const activeBtn = document.querySelector(`.view-btn[data-view="${currentView}"]`);
  if (activeBtn) activeBtn.classList.add("active");
  
  if (currentView === "month") {
    if (monthView) monthView.classList.remove("hidden");
    renderMonthView();
  } else if (currentView === "week") {
    if (weekView) weekView.classList.remove("hidden");
    renderWeekView();
  } else if (currentView === "year") {
    if (yearView) yearView.classList.remove("hidden");
    renderYearView();
  }
  
  syncMiniCalendar();
}

// Sync mini calendar
function syncMiniCalendar() {
  currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar(currentDate);
}

// ===== Event Handlers =====

// Mini calendar navigation
if (prevMonth) {
  prevMonth.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderMiniCalendar(currentDate);
  };
}

if (nextMonth) {
  nextMonth.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderMiniCalendar(currentDate);
  };
}

// Main view navigation
if (prevMonthMain) {
  prevMonthMain.onclick = () => {
    selectedDate.setMonth(selectedDate.getMonth() - 1);
    syncMiniCalendar();
    updateView();
  };
}

if (nextMonthMain) {
  nextMonthMain.onclick = () => {
    selectedDate.setMonth(selectedDate.getMonth() + 1);
    syncMiniCalendar();
    updateView();
  };
}

if (prevYear) {
  prevYear.onclick = () => {
    selectedDate.setFullYear(selectedDate.getFullYear() - 1);
    syncMiniCalendar();
    updateView();
  };
}

if (nextYear) {
  nextYear.onclick = () => {
    selectedDate.setFullYear(selectedDate.getFullYear() + 1);
    syncMiniCalendar();
    updateView();
  };
}

// Buttons
if (createEventBtn) {
  createEventBtn.onclick = () => {
    if (isModalOpen()) return;
    openEventModal(selectedDate);
  };
}

if (viewAllEventsBtn) {
  viewAllEventsBtn.onclick = () => {
    if (isModalOpen()) return;
    openAllEventsModal();
  };
}

if (manageFriendsBtn) {
  manageFriendsBtn.onclick = () => {
    if (profileMenu) profileMenu.classList.add('hidden');
    openFriendsModal();
  };
}

if (createCalendarBtn) {
  createCalendarBtn.onclick = () => openCalendarFormModal();
}

if (manageCalendarsTopBtn) {
  manageCalendarsTopBtn.onclick = openCalendarModal;
}

// Color picker buttons
document.querySelectorAll('.color-option').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (calendarColorInput) {
      calendarColorInput.value = btn.dataset.color;
    }
  };
});

// Calendar form submit
if (calendarForm) {
  calendarForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const name = calendarNameInput?.value.trim();
    const color = calendarColorInput?.value;
    const description = calendarDescriptionInput?.value.trim();
    
    if (!name) {
      showToast('Calendar name is required', 'error');
      return;
    }
    
    let result;
    if (editingCalendarId) {
      result = await updateCalendarAPI(editingCalendarId, name, color, description);
    } else {
      result = await createCalendarAPI(name, color, description);
      if (result) {
        window.visibleCalendars.add(result._id);
        saveVisibleCalendars();
      }
    }
    
    if (result) {
      closeModal('calendarFormModal');
      await loadCalendars();
      fetchEvents();
    }
  };
}

// Delete calendar button
if (deleteCalendarBtn) {
  deleteCalendarBtn.onclick = () => {
    if (editingCalendarId) {
      deleteCalendarAPI(editingCalendarId);
    }
  };
}

// Calendar selector change
const calendarSelect = document.getElementById('eventCalendarSelect');
if (calendarSelect) {
  calendarSelect.addEventListener('change', (e) => {
    selectedCalendarId = e.target.value;
  });
}

// ===== Calendar Sharing Functions =====

// Open share calendar modal
async function openShareCalendarModal(calendar) {
  if (!currentUser) {
    showToast('Please log in first', 'warning');
    return;
  }

  sharingCalendarId = calendar._id;
  
  const modal = document.getElementById('shareCalendarModal');
  const titleEl = document.getElementById('shareCalendarTitle');
  const nameEl = document.getElementById('sharingCalendarName');
  
  if (titleEl) titleEl.textContent = `Share "${calendar.name}"`;
  if (nameEl) nameEl.textContent = calendar.name;

  // Load current sharing info
  await loadCalendarSharing(calendar._id);
  
  // Load available friends
  await loadAvailableFriendsForSharing(calendar._id);
  
  openModal(modal);
}

// Load calendar sharing details
async function loadCalendarSharing(calendarId) {
  const listEl = document.getElementById('currentlySharedList');
  if (!listEl) return;
  
  listEl.innerHTML = '<p style="text-align:center;color:#666;padding:12px;">Loading...</p>';
  
  try {
    const res = await fetch(`/api/calendars/${calendarId}/sharing`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) throw new Error('Failed to load sharing info');
    
    const data = await res.json();
    
    if (data.sharedWith.length === 0) {
      listEl.innerHTML = '<p style="text-align:center;color:#666;padding:12px;font-style:italic;">Not shared with anyone yet</p>';
      return;
    }
    
    listEl.innerHTML = '';
    
    data.sharedWith.forEach(share => {
      const div = document.createElement('div');
      div.className = 'shared-user-item';
      
      const initials = (share.user.displayName || share.user.username)[0].toUpperCase();
      const avatarContent = share.user.profileImage 
        ? `<img src="${share.user.profileImage}" alt="">` 
        : initials;
      
      div.innerHTML = `
        <div class="share-user-info">
          <div class="share-user-avatar">
            ${avatarContent}
          </div>
          <div class="share-user-details">
            <div class="share-user-name">${share.user.displayName || share.user.username}</div>
            <div class="share-user-permission">
              <span class="permission-badge ${share.permission}">${share.permission}</span>
            </div>
          </div>
        </div>
        <div class="share-actions">
          <button class="unshare-btn small-btn">Remove</button>
        </div>
      `;
      
      const unshareBtn = div.querySelector('.unshare-btn');
      if (unshareBtn) {
        unshareBtn.onclick = () => unshareCalendarFromUser(calendarId, share.user._id);
      }
      
      listEl.appendChild(div);
    });
  } catch (e) {
    console.error('Load sharing error:', e);
    listEl.innerHTML = '<p style="text-align:center;color:#f44336;padding:12px;">Failed to load sharing info</p>';
    showToast('Failed to load sharing info', 'error');
  }
}

// Load available friends for sharing
async function loadAvailableFriendsForSharing(calendarId) {
  const listEl = document.getElementById('availableFriendsList');
  if (!listEl) return;
  
  listEl.innerHTML = '<p style="text-align:center;color:#666;padding:12px;">Loading...</p>';
  
  try {
    // Get friends
    const friendsRes = await fetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (friendsRes.status === 401) {
      handleUnauthorized();
      return;
    }
    
    const friends = await friendsRes.json();
    
    // Get current sharing
    const sharingRes = await fetch(`/api/calendars/${calendarId}/sharing`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    const sharingData = await sharingRes.json();
    const sharedUserIds = sharingData.sharedWith.map(s => s.user._id || s.user);
    
    // Filter out already shared friends
    const availableFriends = friends.filter(f => !sharedUserIds.includes(f.id || f._id));
    
    if (availableFriends.length === 0) {
      listEl.innerHTML = '<p style="text-align:center;color:#666;padding:12px;font-style:italic;">All friends already have access</p>';
      return;
    }
    
    listEl.innerHTML = '';
    
    availableFriends.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'friend-share-item';
      
      const initials = (friend.displayName || friend.username)[0].toUpperCase();
      const avatarContent = friend.profileImage 
        ? `<img src="${friend.profileImage}" alt="">` 
        : initials;
      
      div.innerHTML = `
        <div class="share-user-info">
          <div class="share-user-avatar">
            ${avatarContent}
          </div>
          <div class="share-user-details">
            <div class="share-user-name">${friend.displayName || friend.username}</div>
          </div>
        </div>
        <div class="share-actions">
          <button class="share-btn small-btn">Share</button>
        </div>
      `;
      
      const shareBtn = div.querySelector('.share-btn');
      if (shareBtn) {
        shareBtn.onclick = () => shareCalendarWithFriend(calendarId, friend.id || friend._id);
      }
      
      listEl.appendChild(div);
    });
  } catch (e) {
    console.error('Load friends error:', e);
    listEl.innerHTML = '<p style="text-align:center;color:#f44336;padding:12px;">Failed to load friends</p>';
    showToast('Failed to load friends', 'error');
  }
}

// Share calendar with friend
async function shareCalendarWithFriend(calendarId, friendId) {
  try {
    showLoading();
    
    const res = await fetch(`/api/calendars/${calendarId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ 
        friendIds: [friendId],
        permission: 'view'
      })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to share calendar');
    }
    
    const result = await res.json();
    
    if (result.results.shared.length > 0) {
      showToast('Calendar shared successfully!', 'success');
      await loadCalendarSharing(calendarId);
      await loadAvailableFriendsForSharing(calendarId);
      await loadCalendars();
    } else if (result.results.notFriends.length > 0) {
      showToast('User is not your friend', 'error');
    } else if (result.results.alreadyShared.length > 0) {
      showToast('Calendar already shared with this user', 'warning');
    }
  } catch (e) {
    console.error('Share calendar error:', e);
    showToast(e.message || 'Failed to share calendar', 'error');
  } finally {
    hideLoading();
  }
}

// Unshare calendar from user
async function unshareCalendarFromUser(calendarId, userId) {
  if (!confirm('Remove this person\'s access to the calendar?')) return;
  
  try {
    showLoading();
    
    const res = await fetch(`/api/calendars/${calendarId}/share`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ userId })
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to unshare calendar');
    }
    
    showToast('Access removed successfully', 'success');
    await loadCalendarSharing(calendarId);
    await loadAvailableFriendsForSharing(calendarId);
    await loadCalendars();
  } catch (e) {
    console.error('Unshare calendar error:', e);
    showToast(e.message || 'Failed to remove access', 'error');
  } finally {
    hideLoading();
  }
}

// Settings
if (timeFormatToggle) {
  timeFormatToggle.onclick = () => {
    use24Hour = !use24Hour;
    timeFormatToggle.textContent = `Switch to ${use24Hour ? "12-Hour" : "24-Hour"}`;
    
    if (eventAMPMSelect) eventAMPMSelect.disabled = use24Hour;
    if (eventEndAMPMSelect) eventEndAMPMSelect.disabled = use24Hour;
    
    updateView();
  };
}

if (darkModeToggle) {
  darkModeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    
    const isDark = document.body.classList.contains("dark-mode");
    darkModeToggle.textContent = isDark ? "Toggle Light Mode" : "Toggle Dark Mode";
    
    try {
      localStorage.setItem("darkMode", isDark);
    } catch (e) {
      console.error("Failed to save dark mode setting:", e);
    }
    
    const currentColor = localStorage.getItem("buttonColor") || buttonColorPicker?.value || "#008000";
    if (currentColor) {
      updateButtonColor(currentColor);
    }
  };
}

if (buttonColorPicker) {
  buttonColorPicker.oninput = () => {
    if (buttonColorPreset) {
      buttonColorPreset.value = buttonColorPicker.value;
    }
    updateButtonColor(buttonColorPicker.value);
  };
}

if (buttonColorPreset) {
  buttonColorPreset.onchange = () => {
    if (buttonColorPicker) {
      buttonColorPicker.value = buttonColorPreset.value;
    }
    updateButtonColor(buttonColorPreset.value);
  };
}

if (eventColorPicker) {
  eventColorPicker.oninput = () => {
    if (eventColorPreset) {
      eventColorPreset.value = eventColorPicker.value;
    }
  };
}

if (eventColorPreset) {
  eventColorPreset.onchange = () => {
    if (eventColorPicker) {
      eventColorPicker.value = eventColorPreset.value;
    }
  };
}

// Recurrence
if (recurrenceCheckbox) {
  recurrenceCheckbox.onchange = () => {
    if (recurrenceFrequency) {
      recurrenceFrequency.disabled = !recurrenceCheckbox.checked;
    }
    const recurrenceContainer = document.getElementById("recurrenceContainer");
    if (recurrenceContainer) {
      recurrenceContainer.classList.toggle("hidden", !recurrenceCheckbox.checked);
    }
  };
}

// Form validation
if (eventTitleInput) {
  eventTitleInput.oninput = updateValidationState;
}

if (eventDateInput) {
  eventDateInput.oninput = updateValidationState;
}

if (eventMinuteInput) {
  eventMinuteInput.onblur = () => {
    const suggestions = ['00', '15', '30', '45'];
    const current = eventMinuteInput.value;
    if (!suggestions.includes(current) && current.length === 2) {
      const num = parseInt(current);
      const nearest = Math.round(num / 15) * 15;
      eventMinuteInput.value = String(nearest).padStart(2, "0");
    }
  };
}

if (eventEndMinuteInput) {
  eventEndMinuteInput.onblur = () => {
    const suggestions = ['00', '15', '30', '45'];
    const current = eventEndMinuteInput.value;
    if (!suggestions.includes(current) && current.length === 2) {
      const num = parseInt(current);
      const nearest = Math.round(num / 15) * 15;
      eventEndMinuteInput.value = String(nearest).padStart(2, "0");
    }
  };
}

// Auto-sync end time
if (eventHourInput) {
  eventHourInput.onchange = () => {
    if (!untilCheckbox?.checked || !eventEndHourInput) return;
    
    let newEndHour = parseInt(eventHourInput.value) + 1;
    if (!use24Hour && newEndHour > 12) newEndHour = 1;
    
    eventEndHourInput.value = newEndHour;
    updateValidationState();
  };
}

if (allDayCheckbox) {
  allDayCheckbox.onchange = updateTimeInputs;
}

if (untilCheckbox) {
  untilCheckbox.onchange = updateTimeInputs;
}

// Event form submit
if (eventForm) {
  eventForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showToast("Please log in", "warning");
      return;
    }

    const title = eventTitleInput?.value.trim();
    const date = eventDateInput?.value;
    
    if (!title || !date) {
      showToast("Title and date required", "error");
      return;
    }

    if (!selectedCalendarId) {
      showToast("Select a calendar", "error");
      return;
    }

    let time = null, endTime = null;
    const isAllDay = allDayCheckbox?.checked || false;

    if (!isAllDay) {
      let hour = parseInt(eventHourInput?.value);
      const minute = parseInt(eventMinuteInput?.value) || 0;
      
      if (isNaN(hour) || isNaN(minute)) {
        showToast("Invalid start time", "error");
        return;
      }

      if (!use24Hour && eventAMPMSelect) {
        if (eventAMPMSelect.value === "PM" && hour !== 12) hour += 12;
        if (eventAMPMSelect.value === "AM" && hour === 12) hour = 0;
      }
      
      time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      if (untilCheckbox?.checked) {
        let endHour = parseInt(eventEndHourInput?.value);
        const endMinute = parseInt(eventEndMinuteInput?.value) || 0;
        
        if (isNaN(endHour) || isNaN(endMinute)) {
          showToast("Invalid end time", "error");
          return;
        }

        if (!use24Hour && eventEndAMPMSelect) {
          if (eventEndAMPMSelect.value === "PM" && endHour !== 12) endHour += 12;
          if (eventEndAMPMSelect.value === "AM" && endHour === 12) endHour = 0;
        }
        
        endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
        
        if (getTimeInMinutes(time) >= getTimeInMinutes(endTime)) {
          showToast("End time must be after start time", "error");
          return;
        }
      }
    }
    
    const recurrence = recurrenceCheckbox?.checked ? {
      frequency: recurrenceFrequency?.value || 'daily'
    } : undefined;

    const shareWithSelect = document.getElementById('shareWithFriends');
    const shareWith = shareWithSelect 
      ? Array.from(shareWithSelect.selectedOptions).map(o => o.value)
      : [];

    const eventData = {
      calendarId: selectedCalendarId,
      title,
      date,
      isAllDay,
      time: isAllDay ? null : time,
      endTime: isAllDay ? null : endTime,
      details: eventDetailsInput?.value.trim() || '',
      location: eventLocationInput?.value.trim() || '',
      color: eventColorPicker?.value || getRandomPastelColor(),
      recurrence,
      shareWith
    };
    
    try {
      showLoading();
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(eventData)
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Save failed');
      }

      const saved = await res.json();
      const normalized = { 
        ...saved, 
        id: saved._id, 
        date: saved.date.split('T')[0] 
      };

      if (editingEvent) {
        const idx = events.findIndex(e => e.id === editingEvent.id);
        if (idx !== -1) events[idx] = normalized;
      } else {
        events.push(normalized);
      }

      eventCache.clear();
      closeModal('eventModal');
      updateView();
      showToast(editingEvent ? 'Event updated!' : 'Event created!', 'success');
    } catch (err) {
      showToast(err.message || "Error saving event", "error");
    } finally {
      hideLoading();
    }
  };
}

// Delete event button
if (deleteEventBtn) {
  deleteEventBtn.onclick = async () => {
    if (!currentUser || !activeEventId) return;
    
    if (!confirm('Delete this event?')) return;
    
    try {
      showLoading();
      const response = await fetch(`/api/events/${activeEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwtToken}` },
      });
      
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      
      if (!response.ok) throw new Error('Failed to delete event');
      
      events = events.filter(e => e.id !== activeEventId);
      eventCache.clear();
      closeModal('detailsModal');
      updateView();
      showToast('Event deleted', 'success');
    } catch (e) {
      console.error("Failed to delete event:", e);
      showToast("Error deleting event", "error");
    } finally {
      hideLoading();
    }
  };
}

// Edit event button
if (editEventBtn) {
  editEventBtn.onclick = () => {
    const event = events.find(e => e.id === activeEventId);
    if (event) {
      closeModal('detailsModal');
      openEventModal(parseDateOnly(event.date), event);
    }
  };
}

// Login button
if (logInButton) {
  logInButton.onclick = () => {
    if (isModalOpen()) return;
    
    if (authSubmit) authSubmit.textContent = "Log In";
    if (toggleAuth) toggleAuth.textContent = "Switch to Register";
    
    if (emailInput) {
      emailInput.classList.add("hidden");
      const emailLabel = emailInput.previousElementSibling;
      if (emailLabel) emailLabel.classList.add("hidden");
    }
    
    if (authMessage) authMessage.textContent = "";
    
    openModal('loginModal', () => {
      if (usernameInput) usernameInput.focus();
    });
  };
}

// Toggle auth mode
if (toggleAuth) {
  toggleAuth.onclick = () => {
    const isLogin = authSubmit?.textContent === "Log In";
    
    if (authSubmit) {
      authSubmit.textContent = isLogin ? "Register" : "Log In";
    }
    
    if (toggleAuth) {
      toggleAuth.textContent = isLogin ? "Switch to Log In" : "Switch to Register";
    }
    
    if (emailInput) {
      emailInput.classList.toggle("hidden");
      const emailLabel = emailInput.previousElementSibling;
      if (emailLabel) emailLabel.classList.toggle("hidden");
    }
    
    if (authMessage) authMessage.textContent = "";
  };
}

// Auth form submit
if (authForm) {
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;
    const email = emailInput?.value.trim();
    
    if (!username || !password) {
      if (authMessage) {
        authMessage.textContent = "Username and password are required";
      }
      showToast("Username and password are required", "error");
      return;
    }
    
    const isLogin = authSubmit?.textContent === "Log In";
    const success = isLogin
      ? await handleLogin(username, password)
      : await handleRegister(username, password, email);
      
    if (success) {
      closeModal('loginModal');
      updateAuthUI();
      fetchEvents();
    }
  };
}

// View buttons
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.onclick = () => {
    if (isModalOpen()) return;
    currentView = btn.dataset.view;
    updateView();
  };
});

// Profile handlers
if (profileButton) {
  profileButton.onclick = () => {
    if (profileMenu) {
      profileMenu.classList.toggle("hidden");
    }
  };
}

// Close profile menu when clicking outside
document.addEventListener("click", (e) => {
  if (profileContainer && profileMenu && !profileContainer.contains(e.target)) {
    profileMenu.classList.add("hidden");
  }
});

if (profileSettingsBtn) {
  profileSettingsBtn.onclick = () => {
    if (profileMenu) profileMenu.classList.add("hidden");
    openProfileSettingsModal();
  };
}

if (accountSettingsBtn) {
  accountSettingsBtn.onclick = () => {
    if (profileMenu) profileMenu.classList.add("hidden");
    openAccountSettingsModal();
  };
}

if (logOutButtonMenu) {
  logOutButtonMenu.onclick = () => {
    if (profileMenu) profileMenu.classList.add("hidden");
    handleLogout();
  };
}

// Profile form submit
if (profileForm) {
  profileForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const data = {
      displayName: displayName?.value.trim() || currentUser.username,
      bio: profileBio?.value.trim() || '',
    };
    
    if (profileImageInput?.files[0]) {
      try {
        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent;
        if (submitBtn) {
          submitBtn.textContent = 'Uploading...';
          submitBtn.disabled = true;
        }

        data.profileImage = await resizeImage(profileImageInput.files[0], 200, 200, 0.85);
        
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (err) {
        showToast("Error processing image. Try a smaller file.", "error");
        return;
      }
    }
    
    try {
      showLoading();
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      
      const updated = await response.json();
      currentUser = { ...currentUser, ...updated };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      
      updateProfileUI();
      renderFriendsList();
      closeModal('profileSettingsModal');
      showToast('Profile updated successfully', 'success');
    } catch (e) {
      console.error("Profile update error:", e);
      showToast(e.message || "Error updating profile", "error");
    } finally {
      hideLoading();
    }
  };
}

// Account form submit
if (accountForm) {
  accountForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const data = {
      email: accEmail?.value.trim() || '',
    };
    
    if (accNewPassword?.value.trim()) {
      data.password = accNewPassword.value.trim();
    }
    
    try {
      showLoading();
      const response = await fetch('/api/user/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update account');
      }
      
      const updated = await response.json();
      currentUser = { ...currentUser, ...updated };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      
      updateProfileUI();
      closeModal('accountSettingsModal');
      showToast('Account updated successfully', 'success');
    } catch (e) {
      console.error("Account update error:", e);
      showToast(e.message || "Error updating account", "error");
    } finally {
      hideLoading();
    }
  };
}

// Initialize character counters
updateCharCount('eventTitle', 'titleCount', 100);
updateCharCount('eventDetails', 'detailsCount', 500);

// Initialize app
loadSettings();
updateCalendarTitle();
setupFriendsTabs();
updateView();
renderFriendsSidebar();
loadLeaderboard();