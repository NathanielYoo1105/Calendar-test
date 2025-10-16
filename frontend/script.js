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
const eventCache = new Map();

// Load settings from localStorage
function loadSettings() {
  try {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") {
      document.body.classList.add("dark-mode");
      darkModeToggle.checked = true;
    }
    const savedButtonColor = localStorage.getItem("buttonColor");
    if (savedButtonColor) {
      buttonColorPicker.value = savedButtonColor;
      buttonColorPreset.value = savedButtonColor;
      updateButtonColor(savedButtonColor);
    }
    const savedToken = localStorage.getItem("jwtToken");
    const savedUser = localStorage.getItem("currentUser");
    if (savedToken && savedUser) {
      jwtToken = savedToken;
      currentUser = savedUser;
      updateAuthUI();
      fetchEvents();
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
    showErrorMessage("Error loading settings.");
  }
}

// Fetch events from backend
async function fetchEvents() {
  try {
    console.log('Fetching events for user:', currentUser);
    const response = await fetch('/api/events', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    if (response.status === 401) {
      console.log('Unauthorized, triggering re-login');
      handleUnauthorized();
      return;
    }
    if (!response.ok) throw new Error(`Failed to fetch events: ${response.status}`);
    events = await response.json();
    console.log('Fetched events:', events);
    events = events.map(e => ({
      ...e,
      id: e._id,
      date: e.date.split('T')[0], // Directly normalize to YYYY-MM-DD string (assumes server sends ISO)
      recurrence: e.recurrence ? {
        ...e.recurrence,
        type: e.recurrence.frequency
      } : null
    }));
    eventCache.clear();
    updateView();
  } catch (e) {
    console.error("Failed to fetch events:", e);
    showErrorMessage("Error fetching events.");
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
  showErrorMessage("Session expired. Please log in again.", loginModal);
  loginModal.classList.add("open");
  usernameInput.focus();
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
const viewAllEventsBtn = document.createElement("button"); // New button
viewAllEventsBtn.id = "viewAllEventsButton";
viewAllEventsBtn.textContent = "View All Events";
viewAllEventsBtn.className = "view-all-events-btn";
createEventBtn.parentNode.insertBefore(viewAllEventsBtn, createEventBtn.nextSibling); // Insert after create button
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
const closeEventModal = eventModal.querySelector(".close-btn");
const eventForm = document.getElementById("eventForm");
const eventTitleInput = document.getElementById("eventTitle");
const eventDateInput = document.getElementById("eventDate");
const eventHourInput = document.getElementById("eventHour");
const eventMinuteInput = document.getElementById("eventMinute");
const eventAMPMSelect = document.getElementById("eventAMPM");
const eventDetailsInput = document.getElementById("eventDetails");
const allDayCheckbox = document.getElementById("allDayCheckbox");
const untilCheckbox = document.getElementById("untilCheckbox");
const eventEndHourInput = document.getElementById("eventEndHour");
const eventEndMinuteInput = document.getElementById("eventEndMinute");
const eventEndAMPMSelect = document.getElementById("eventEndAMPM");
const recurrenceTypeSelect = document.getElementById("recurrenceType");
const recurrenceIntervalInput = document.getElementById("recurrenceInterval");
const recurrenceUnitSpan = document.getElementById("recurrenceUnit");
const recurrenceUntilInput = document.getElementById("recurrenceUntil");
const timeInputs = document.getElementById("timeInputs");
const untilContainer = document.getElementById("untilContainer");
const endTimeInputs = document.getElementById("endTimeInputs");
const recurrenceInputs = document.getElementById("recurrenceInputs");
const detailsModal = document.getElementById("detailsModal");
const closeDetailsModal = document.getElementById("closeDetailsModal");
const detailsContent = document.getElementById("detailsContent");
const deleteEventBtn = document.getElementById("deleteEventButton");
const editEventBtn = document.getElementById("editEventButton");
const loginModal = document.getElementById("loginModal");
const closeLoginModal = document.getElementById("closeLoginModal");
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
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");

// New: All Events Modal
const allEventsModal = document.createElement("div");
allEventsModal.id = "allEventsModal";
allEventsModal.className = "modal";
allEventsModal.setAttribute("aria-hidden", "true");
allEventsModal.innerHTML = `
  <div class="modal-content">
    <span class="close-btn">X</span>
    <h2>All Events</h2>
    <div id="allEventsList" class="all-events-list"></div>
  </div>
`;
document.body.appendChild(allEventsModal);
const closeAllEventsModal = allEventsModal.querySelector(".close-btn");
const allEventsList = document.getElementById("allEventsList");

// ===== Utility Functions =====
function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day); // Local date components, no timezone shift
}

function formatTimeForDisplay(event) {
  if (event.isAllDay) return "All Day";
  let timeStr = event.time || "00:00";
  let endStr = event.endTime ? ` - ${event.endTime}` : "";
  if (use24Hour) return timeStr + endStr;
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

function getTimeInMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hour, min] = timeStr.split(":").map(Number);
  return hour * 60 + min;
}

function showErrorMessage(message, target = eventModal) {
  let errorDiv = target.querySelector("#errorMessage");
  if (!errorDiv) {
    errorDiv = document.createElement("div");
    errorDiv.id = "errorMessage";
    target.querySelector(".modal-content").prepend(errorDiv);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  setTimeout(() => errorDiv.style.display = "none", 2000);
}

function monthsBetween(d1, d2) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function matchesDate(ev, date) {
  const evDate = parseDateOnly(ev.date);
  if (!evDate) return false;
  if (!ev.recurrence || ev.recurrence.type === "none") {
    return evDate.toDateString() === date.toDateString();
  }
  const { type, interval = 1, until } = ev.recurrence;
  if (evDate > date) return false;
  const untilDate = until ? parseDateOnly(until) : null;
  if (untilDate && untilDate < date) return false;
  const diffMs = date - evDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (type === "daily") {
    return diffDays % interval === 0;
  } else if (type === "weekly") {
    return date.getDay() === evDate.getDay() && (diffDays % (7 * interval) === 0);
  } else if (type === "monthly") {
    const monthsDiff = monthsBetween(evDate, date);
    return date.getDate() === evDate.getDate() && (monthsDiff % interval === 0);
  }
  return false;
}

function getEventsForDate(targetDate) {
  const cacheKey = targetDate.toDateString();
  if (eventCache.has(cacheKey)) {
    console.log('Returning cached events for', cacheKey);
    return eventCache.get(cacheKey);
  }
  const result = events
    .filter(ev => {
      const evDate = parseDateOnly(ev.date);
      if (!evDate) {
        console.warn('Invalid event date:', ev);
        return false;
      }
      if (ev.recurrence && ev.recurrence.until && ev.recurrence.type !== "none") {
        const untilDate = parseDateOnly(ev.recurrence.until);
        if (untilDate && untilDate < targetDate) return false;
      }
      return matchesDate(ev, targetDate);
    })
    .map(ev => {
      const instance = { ...ev, instanceDate: targetDate.toISOString().split('T')[0] };
      if (ev.date !== instance.instanceDate) {
        instance.date = instance.instanceDate;
        instance.isInstance = true;
      }
      return instance;
    });
  eventCache.set(cacheKey, result);
  return result;
}

function updateButtonColor(color) {
  const root = document.documentElement;
  const isDarkMode = document.body.classList.contains("dark-mode");
  const hoverColor = adjustColorBrightness(color, isDarkMode ? 1.2 : 0.8);
  root.style.setProperty("--button-bg", color);
  root.style.setProperty("--button-hover-bg", hoverColor);
  root.style.setProperty("--button-dark-bg", color);
  root.style.setProperty("--button-dark-hover-bg", hoverColor);
  root.style.setProperty("--event-box-bg", color);
  root.style.setProperty("--event-box-dark-bg", adjustColorBrightness(color, 1.2));
  try {
    localStorage.setItem("buttonColor", color);
  } catch (e) {
    console.error("Failed to save button color:", e);
  }
}

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

// ===== Authentication =====
function updateAuthUI() {
  if (currentUser) {
    userStatus.textContent = `Welcome, ${currentUser}`;
    userStatus.classList.remove("hidden");
    logInButton.classList.add("hidden");
    logOutButton.classList.remove("hidden");
    createEventBtn.classList.remove("hidden");
    viewAllEventsBtn.classList.remove("hidden"); // Show button when logged in
  } else {
    userStatus.classList.add("hidden");
    logInButton.classList.remove("hidden");
    logOutButton.classList.add("hidden");
    createEventBtn.classList.add("hidden");
    viewAllEventsBtn.classList.add("hidden"); // Hide button when logged out
    events = [];
    updateView();
  }
}

async function handleLogin(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) {
      authMessage.textContent = data.message || 'Login failed';
      return false;
    }
    jwtToken = data.token;
    currentUser = data.user.username;
    localStorage.setItem("jwtToken", jwtToken);
    localStorage.setItem("currentUser", currentUser);
    authMessage.textContent = "Login successful!";
    authMessage.style.color = "#4caf50";
    return true;
  } catch (e) {
    console.error("Login error:", e);
    authMessage.textContent = "Server error during login";
    return false;
  }
}

async function handleRegister(username, password, email) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email: email || undefined })
    });
    const data = await response.json();
    if (!response.ok) {
      authMessage.textContent = data.message || 'Registration failed';
      return false;
    }
    jwtToken = data.token;
    currentUser = data.user.username;
    localStorage.setItem("jwtToken", jwtToken);
    localStorage.setItem("currentUser", currentUser);
    authMessage.textContent = "Registration successful!";
    authMessage.style.color = "#4caf50";
    return true;
  } catch (e) {
    console.error("Registration error:", e);
    authMessage.textContent = "Server error during registration";
    return false;
  }
}

// ===== Focus Trap for Modals =====
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length === 0) return () => {};
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeydown = e => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    } else if (e.key === 'Escape') {
      closeModal(modal);
    }
  };

  modal.addEventListener('keydown', handleKeydown);
  return () => modal.removeEventListener('keydown', handleKeydown);
}

// ===== Mini Calendar =====
function renderMiniCalendar(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  monthYear.textContent = date.toLocaleDateString("default", { month: "long", year: "numeric" });
  calendarBody.innerHTML = "";
  let row = document.createElement("tr");
  for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.textContent = day;
    cell.tabIndex = 0;
    const cellDate = new Date(year, month, day);
    if (cellDate.toDateString() === new Date().toDateString()) cell.classList.add("today");
    if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");
    cell.setAttribute("aria-label", `Day ${day} of ${monthYear.textContent}`);
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
      calendarBody.appendChild(row);
      row = document.createElement("tr");
    }
  }
}

// ===== Month View =====
function renderMonthView() {
  console.log('Rendering month view for:', selectedDate);
  monthTitle.textContent = selectedDate.toLocaleDateString("default", { month: "long", year: "numeric" });
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  bigCalendarBody.innerHTML = "";
  let row = document.createElement("tr");
  for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.tabIndex = 0;
    const cellDate = new Date(year, month, day);
    cell.textContent = day;
    if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");
    cell.setAttribute("aria-label", `Day ${day} of ${monthTitle.textContent}`);
    const handleCellClick = () => {
      if (isModalOpen()) return;
      if (currentUser) {
        selectedDate = cellDate;
        syncMiniCalendar();
        openEventModal(cellDate);
      } else {
        showErrorMessage("Please log in to create events", loginModal);
        loginModal.classList.add("open");
      }
    };
    cell.onclick = handleCellClick;
    cell.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCellClick();
      }
    };
    const dayEvents = getEventsForDate(cellDate).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    });
    dayEvents.slice(0, 3).forEach(event => {
      const div = document.createElement("div");
      div.classList.add("month-event");
      div.tabIndex = 0;
      if (event.isAllDay) div.classList.add("all-day");
      else if (event.color) div.style.backgroundColor = event.color;
      div.textContent = `${event.title} (${formatTimeForDisplay(event)})`;
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
      bigCalendarBody.appendChild(row);
      row = document.createElement("tr");
    }
  }
}

// ===== Week View =====
function renderWeekView() {
  console.log('Rendering week view for:', selectedDate);
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
  prevWeek.onclick = () => {
    selectedDate.setDate(selectedDate.getDate() - 7);
    syncMiniCalendar();
    updateView();
  };
  nextWeek.onclick = () => {
    selectedDate.setDate(selectedDate.getDate() + 7);
    syncMiniCalendar();
    updateView();
  };
  const weekTitle = weekView.querySelector("#weekTitle");
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
  weekTitle.textContent = `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;

  const timeCol = document.createElement("div");
  timeCol.classList.add("time-column");
  for (let h = 0; h < 24; h++) {
    const div = document.createElement("div");
    if (use24Hour) div.textContent = `${h}:00`;
    else {
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? "PM" : "AM";
      div.textContent = `${hour12}:00 ${ampm}`;
    }
    timeCol.appendChild(div);
  }
  gridContainer.appendChild(timeCol);

  for (let d = 0; d < daysToShow; d++) {
    const col = document.createElement("div");
    col.classList.add("day-column");
    const header = document.createElement("div");
    header.classList.add("day-header");
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + d);
    header.textContent = dayDate.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
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
          showErrorMessage("Please log in to create events", loginModal);
          loginModal.classList.add("open");
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
    const dayEvents = getEventsForDate(dayDate).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    });
    dayEvents.filter(e => e.isAllDay).forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("all-day-event");
      evBox.tabIndex = 0;
      if (event.color) evBox.style.backgroundColor = event.color;
      evBox.textContent = event.title;
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
      if (event.color) evBox.style.backgroundColor = event.color;
      else evBox.style.backgroundColor = document.body.classList.contains("dark-mode") ? "var(--event-box-dark-bg)" : "var(--event-box-bg)";
      evBox.textContent = `${event.title} (${formatTimeForDisplay(event)})`;
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

// ===== Year View =====
function renderYearView() {
  console.log('Rendering year view for:', selectedDate.getFullYear());
  yearTitle.textContent = selectedDate.getFullYear();
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
    for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));
    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement("td");
      cell.textContent = day;
      cell.tabIndex = 0;
      const cellDate = new Date(selectedDate.getFullYear(), m, day);
      if (cellDate.toDateString() === new Date().toDateString()) cell.classList.add("today");
      if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");
      const dayEvents = getEventsForDate(cellDate);
      if (dayEvents.length) cell.classList.add("has-events");
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

// ===== View Management =====
function updateView() {
  eventCache.clear();
  console.log('Updating view:', currentView);
  monthView.classList.add("hidden");
  weekView.classList.add("hidden");
  yearView.classList.add("hidden");
  document.querySelectorAll(".view-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.view-btn[data-view="${currentView}"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (currentView === "month") {
    monthView.classList.remove("hidden");
    renderMonthView();
  } else if (currentView === "week") {
    weekView.classList.remove("hidden");
    renderWeekView();
  } else if (currentView === "year") {
    yearView.classList.remove("hidden");
    renderYearView();
  }
  syncMiniCalendar();
}

function syncMiniCalendar() {
  currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar(currentDate);
}

// ===== Modal Management =====
function isModalOpen() {
  return eventModal.classList.contains('open') || 
         loginModal.classList.contains('open') || 
         detailsModal.classList.contains('open') ||
         allEventsModal.classList.contains('open');
}

function openEventModal(date, event = null) {
  if (!currentUser) {
    showErrorMessage("Please log in to create/edit events", loginModal);
    loginModal.classList.add("open");
    return;
  }
  editingEvent = event;
  eventModal.querySelector("h2").textContent = event ? "Edit Event" : "Create Event";
  eventForm.reset();
  eventDateInput.value = date.toISOString().split('T')[0];
  eventColorPicker.value = event ? event.color : "#4caf50";
  eventColorPreset.value = event ? event.color : "#4caf50";
  allDayCheckbox.checked = event ? event.isAllDay : false;
  untilCheckbox.checked = event && event.endTime ? true : false;
  recurrenceTypeSelect.value = (event && event.recurrence && event.recurrence.type) ? event.recurrence.type : "none";
  recurrenceIntervalInput.value = (event && event.recurrence) ? event.recurrence.interval : "1";
  recurrenceUntilInput.value = (event && event.recurrence && event.recurrence.until) ? event.recurrence.until : "";
  eventTitleInput.value = event ? event.title : "";
  eventDetailsInput.value = event ? event.details || "" : "";
  if (event && event.time && !event.isAllDay) {
    let [hour, minute] = event.time.split(":").map(Number);
    if (!use24Hour) {
      eventAMPMSelect.value = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
    }
    eventHourInput.value = hour;
    eventMinuteInput.value = minute;
  }
  if (event && event.endTime) {
    let [hour, minute] = event.endTime.split(":").map(Number);
    if (!use24Hour) {
      eventEndAMPMSelect.value = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
    }
    eventEndHourInput.value = hour;
    eventEndMinuteInput.value = minute;
  }
  updateTimeInputs();
  updateRecurrenceInputs();
  eventModal.classList.add("open");
  eventModal.setAttribute("aria-hidden", "false");
  const removeTrap = trapFocus(eventModal);
  eventTitleInput.focus();
  eventModal.addEventListener('transitionend', function cleanup() {
    if (!eventModal.classList.contains('open')) {
      removeTrap();
      eventModal.setAttribute("aria-hidden", "true");
      eventModal.removeEventListener('transitionend', cleanup);
    }
  }, { once: true });
}

function openDetailsModal(event) {
  activeEventId = event.id;
  detailsContent.innerHTML = `
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.date}</p>
    <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
    <p><strong>Details:</strong> ${event.details || "None"}</p>
    ${event.recurrence && event.recurrence.type !== "none" ? `
      <p><strong>Recurrence:</strong> Every ${event.recurrence.interval} ${event.recurrence.type}(s) until ${event.recurrence.until || "indefinite"}</p>
    ` : ""}
  `;
  detailsModal.classList.add("open");
  detailsModal.setAttribute("aria-hidden", "false");
  const removeTrap = trapFocus(detailsModal);
  closeDetailsModal.focus();
  detailsModal.addEventListener('transitionend', function cleanup() {
    if (!detailsModal.classList.contains('open')) {
      removeTrap();
      detailsModal.setAttribute("aria-hidden", "true");
      detailsModal.removeEventListener('transitionend', cleanup);
    }
  }, { once: true });
}

function openAllEventsModal() {
  if (!currentUser) {
    showErrorMessage("Please log in to view events", loginModal);
    loginModal.classList.add("open");
    return;
  }
  // Sort events by date (earliest first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = parseDateOnly(a.date);
    const dateB = parseDateOnly(b.date);
    if (!dateA || !dateB) return 0;
    return dateA - b.date;
  });

  allEventsList.innerHTML = "";
  if (sortedEvents.length === 0) {
    allEventsList.innerHTML = "<p>No events found.</p>";
  } else {
    sortedEvents.forEach(event => {
      const eventItem = document.createElement("div");
      eventItem.className = "all-event-item";
      eventItem.tabIndex = 0;
      let recurrenceText = "None";
      if (event.recurrence && event.recurrence.type && event.recurrence.type !== "none") {
        recurrenceText = `Every ${event.recurrence.interval} ${event.recurrence.type}(s) until ${event.recurrence.until || "indefinite"}`;
      }
      eventItem.innerHTML = `
        <div class="event-summary">
          <strong>${event.title}</strong> - ${event.date} ${formatTimeForDisplay(event)}
          ${event.details ? `<p>${event.details}</p>` : ""}
          <p>Recurrence: ${recurrenceText}</p>
        </div>
        <div class="event-actions">
          <button class="edit-btn small-btn">Edit</button>
          <button class="delete-btn small-btn">Delete</button>
        </div>
      `;
      eventItem.querySelector(".edit-btn").onclick = e => {
        e.stopPropagation();
        closeModal(allEventsModal);
        openEventModal(parseDateOnly(event.date), event);
      };
      eventItem.querySelector(".delete-btn").onclick = async e => {
        e.stopPropagation();
        if (confirm(`Delete "${event.title}"?`)) {
          try {
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
            openAllEventsModal(); // Refresh list
            updateView(); // This ensures calendars reflect the deletion
          } catch (err) {
            console.error("Delete error:", err);
            showErrorMessage("Error deleting event", allEventsModal);
          }
        }
      };
      eventItem.onclick = e => {
        if (e.target.tagName === 'BUTTON') return;
        openDetailsModal(event);
      };
      allEventsList.appendChild(eventItem);
    });
  }
  allEventsModal.classList.add("open");
  allEventsModal.setAttribute("aria-hidden", "false");
  const removeTrap = trapFocus(allEventsModal);
  allEventsModal.addEventListener('transitionend', function cleanup() {
    if (!allEventsModal.classList.contains('open')) {
      removeTrap();
      allEventsModal.setAttribute("aria-hidden", "true");
      allEventsModal.removeEventListener('transitionend', cleanup);
    }
  }, { once: true });
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (modal === eventModal) {
    eventForm.reset();
    editingEvent = null;
  }
  if (modal === detailsModal) {
    activeEventId = null;
  }
  if (modal === loginModal) {
    authForm.reset();
    authMessage.textContent = "";
  }
  if (modal === allEventsModal) {
    allEventsList.innerHTML = "";
  }
}

// ===== Time and Recurrence Inputs =====
function updateTimeInputs() {
  const allDayDisabled = allDayCheckbox.checked;
  const untilChecked = untilCheckbox.checked;
  timeInputs.classList.toggle("hidden", allDayDisabled);
  untilContainer.classList.toggle("hidden", allDayDisabled);
  endTimeInputs.classList.toggle("hidden", allDayDisabled || !untilChecked);
  eventHourInput.disabled = allDayDisabled;
  eventMinuteInput.disabled = allDayDisabled;
  eventAMPMSelect.disabled = allDayDisabled || use24Hour;
  eventEndHourInput.disabled = allDayDisabled || !untilChecked;
  eventEndMinuteInput.disabled = allDayDisabled || !untilChecked;
  eventEndAMPMSelect.disabled = allDayDisabled || !untilChecked || use24Hour;
}

function updateRecurrenceInputs() {
  const recurrenceType = recurrenceTypeSelect.value;
  const isRecurring = recurrenceType !== "none";
  recurrenceInputs.classList.toggle("hidden", !isRecurring);
  recurrenceIntervalInput.disabled = !isRecurring;
  recurrenceUntilInput.disabled = !isRecurring;
  recurrenceUnitSpan.textContent = isRecurring ? recurrenceType : "";
}

// ===== Event Handlers =====
prevMonth.onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderMiniCalendar(currentDate);
};

nextMonth.onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderMiniCalendar(currentDate);
};

prevMonthMain.onclick = () => {
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  syncMiniCalendar();
  updateView();
};

nextMonthMain.onclick = () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  syncMiniCalendar();
  updateView();
};

prevYear.onclick = () => {
  selectedDate.setFullYear(selectedDate.getFullYear() - 1);
  syncMiniCalendar();
  updateView();
};

nextYear.onclick = () => {
  selectedDate.setFullYear(selectedDate.getFullYear() + 1);
  syncMiniCalendar();
  updateView();
};

createEventBtn.onclick = () => {
  if (isModalOpen()) return;
  openEventModal(selectedDate);
};

viewAllEventsBtn.onclick = () => {
  if (isModalOpen()) return;
  openAllEventsModal();
};

closeEventModal.onclick = () => closeModal(eventModal);
closeDetailsModal.onclick = () => closeModal(detailsModal);
closeLoginModal.onclick = () => closeModal(loginModal);
closeAllEventsModal.onclick = () => closeModal(allEventsModal);

timeFormatToggle.onclick = () => {
  use24Hour = !use24Hour;
  timeFormatToggle.textContent = `Switch to ${use24Hour ? "12-Hour" : "24-Hour"}`;
  eventAMPMSelect.disabled = use24Hour;
  eventEndAMPMSelect.disabled = use24Hour;
  updateView();
};

darkModeToggle.onclick = () => {
  document.body.classList.toggle("dark-mode");
  try {
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
  } catch (e) {
    console.error("Failed to save dark mode setting:", e);
  }
  updateButtonColor(buttonColorPicker.value);
};

buttonColorPicker.oninput = () => {
  buttonColorPreset.value = buttonColorPicker.value;
  updateButtonColor(buttonColorPicker.value);
};

buttonColorPreset.onchange = () => {
  buttonColorPicker.value = buttonColorPreset.value;
  updateButtonColor(buttonColorPreset.value);
};

eventColorPicker.oninput = () => {
  eventColorPreset.value = eventColorPicker.value;
};

eventColorPreset.onchange = () => {
  eventColorPicker.value = eventColorPreset.value;
};

allDayCheckbox.onchange = updateTimeInputs;
untilCheckbox.onchange = updateTimeInputs;

recurrenceTypeSelect.onchange = () => {
  updateRecurrenceInputs();
  if (recurrenceTypeSelect.value !== "none") {
    recurrenceUntilInput.value = recurrenceUntilInput.value || new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().split('T')[0];
  }
};

eventForm.onsubmit = async e => {
  e.preventDefault();
  if (!currentUser) {
    showErrorMessage("Please log in to save events");
    return;
  }
  const title = eventTitleInput.value.trim();
  if (!title) {
    showErrorMessage("Title is required");
    return;
  }
  const date = eventDateInput.value;
  if (!date) {
    showErrorMessage("Date is required");
    return;
  }
  let time = null;
  let endTime = null;
  if (!allDayCheckbox.checked) {
    let hour = parseInt(eventHourInput.value);
    const minute = parseInt(eventMinuteInput.value) || 0;
    if (isNaN(hour) || isNaN(minute)) {
      showErrorMessage("Valid time is required");
      return;
    }
    if (!use24Hour) {
      if (eventAMPMSelect.value === "PM" && hour !== 12) hour += 12;
      if (eventAMPMSelect.value === "AM" && hour === 12) hour = 0;
    }
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (untilCheckbox.checked) {
      let endHour = parseInt(eventEndHourInput.value);
      const endMinute = parseInt(eventEndMinuteInput.value) || 0;
      if (isNaN(endHour) || isNaN(endMinute)) {
        showErrorMessage("Valid end time is required");
        return;
      }
      if (!use24Hour) {
        if (eventEndAMPMSelect.value === "PM" && endHour !== 12) endHour += 12;
        if (eventEndAMPMSelect.value === "AM" && endHour === 12) endHour = 0;
      }
      endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      if (getTimeInMinutes(time) >= getTimeInMinutes(endTime)) {
        showErrorMessage("End time must be after start time");
        return;
      }
    }
  }
  const recurrence = recurrenceTypeSelect.value !== "none" ? {
    type: recurrenceTypeSelect.value,
    interval: parseInt(recurrenceIntervalInput.value) || 1,
    until: recurrenceUntilInput.value || undefined,
  } : null;
  const eventData = {
    title,
    date,
    isAllDay: allDayCheckbox.checked,
    time,
    endTime,
    details: eventDetailsInput.value,
    color: eventColorPicker.value,
    recurrence,
  };
  try {
    let response;
    if (editingEvent) {
      response = await fetch(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(eventData),
      });
    } else {
      response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(eventData),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save event');
    }
    const savedEvent = await response.json();
    if (editingEvent) {
      const index = events.findIndex(e => e.id === editingEvent.id);
      if (index !== -1) events[index] = { ...savedEvent, id: savedEvent._id, date: savedEvent.date.split('T')[0], recurrence: savedEvent.recurrence || null };
    } else {
      events.push({ ...savedEvent, id: savedEvent._id, date: savedEvent.date.split('T')[0], recurrence: savedEvent.recurrence || null });
    }
    eventCache.clear();
    closeModal(eventModal);
    updateView();
  } catch (e) {
    console.error("Failed to save event:", e);
    showErrorMessage(e.message || "Error saving event");
  }
};

deleteEventBtn.onclick = async () => {
  if (!currentUser || !activeEventId) return;
  try {
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
    closeModal(detailsModal);
    updateView();
  } catch (e) {
    console.error("Failed to delete event:", e);
    showErrorMessage("Error deleting event", detailsModal);
  }
};

editEventBtn.onclick = () => {
  const event = events.find(e => e.id === activeEventId);
  if (event) {
    closeModal(detailsModal);
    openEventModal(parseDateOnly(event.date), event);
  }
};

logInButton.onclick = () => {
  if (isModalOpen()) return;
  loginModal.classList.add("open");
  loginModal.setAttribute("aria-hidden", "false");
  authSubmit.textContent = "Log In";
  toggleAuth.textContent = "Switch to Register";
  emailInput.classList.add("hidden");
  emailInput.previousElementSibling.classList.add("hidden");
  authMessage.textContent = "";
  const removeTrap = trapFocus(loginModal);
  usernameInput.focus();
  loginModal.addEventListener('transitionend', function cleanup() {
    if (!loginModal.classList.contains('open')) {
      removeTrap();
      loginModal.setAttribute("aria-hidden", "true");
      loginModal.removeEventListener('transitionend', cleanup);
    }
  }, { once: true });
};

logOutButton.onclick = () => {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("currentUser");
  updateAuthUI();
};

toggleAuth.onclick = () => {
  const isLogin = authSubmit.textContent === "Log In";
  authSubmit.textContent = isLogin ? "Register" : "Log In";
  toggleAuth.textContent = isLogin ? "Switch to Log In" : "Switch to Register";
  emailInput.classList.toggle("hidden");
  emailInput.previousElementSibling.classList.toggle("hidden");
  authMessage.textContent = "";
};

authForm.onsubmit = async e => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const email = emailInput.value.trim();
  if (!username || !password) {
    authMessage.textContent = "Username and password are required";
    return;
  }
  const isLogin = authSubmit.textContent === "Log In";
  const success = isLogin
    ? await handleLogin(username, password)
    : await handleRegister(username, password, email);
  if (success) {
    closeModal(loginModal);
    updateAuthUI();
    fetchEvents();
  }
};

settingsButton.onclick = () => {
  settingsPanel.classList.toggle("hidden");
};

document.querySelectorAll(".view-btn").forEach(btn => {
  btn.onclick = () => {
    if (isModalOpen()) return;
    currentView = btn.dataset.view;
    updateView();
  };
});

// Initialize
loadSettings();
updateView();