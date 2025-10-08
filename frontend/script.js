// ===== Global State =====
let events = [];
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false;
let currentView = "week"; // Changed default view to week
let editingEvent = null;
let activeEventId = null;
let userXP = 0;
let userRank = "Bronze";
let currentUser = null;
const rankThresholds = [
  { rank: "Bronze", xp: 0 },
  { rank: "Silver", xp: 100 },
  { rank: "Gold", xp: 250 },
  { rank: "Platinum", xp: 500 },
];

// Load data from localStorage
function loadData() {
  try {
    const savedEvents = localStorage.getItem(`calendarEvents_${currentUser || 'guest'}`);
    if (savedEvents) events = JSON.parse(savedEvents);
    const savedXP = localStorage.getItem(`userXP_${currentUser || 'guest'}`);
    if (savedXP) userXP = parseInt(savedXP, 10);
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") document.body.classList.add("dark-mode");
    const savedButtonColor = localStorage.getItem("buttonColor");
    if (savedButtonColor) {
      document.getElementById("buttonColorPicker").value = savedButtonColor;
      document.getElementById("buttonColorPreset").value = savedButtonColor;
      updateButtonColor(savedButtonColor);
    }
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      currentUser = savedUser;
      updateAuthUI();
    }
  } catch (e) {
    console.error("Failed to load from localStorage:", e);
    showErrorMessage("Error loading data. Local storage may be disabled.");
  }
}

// ===== DOM Elements =====
const monthYear = document.getElementById("monthYear");
const calendarBody = document.getElementById("calendarBody");
const bigCalendarBody = document.getElementById("bigCalendarBody");
const yearTitle = document.getElementById("yearTitle");
const yearGrid = document.getElementById("yearGrid");
const monthTitle = document.getElementById("monthTitle");
const weekTitle = document.getElementById("weekTitle");
const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const yearView = document.getElementById("yearView");
const createEventBtn = document.getElementById("createEventButton");
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
const prevWeek = document.getElementById("prevWeek");
const nextWeek = document.getElementById("nextWeek");
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
const closeDetailsModal = detailsModal.querySelector(".close-btn");
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
const authMessage = document.getElementById("authMessage");
const logInButton = document.getElementById("logInButton");
const logOutButton = document.getElementById("logOutButton");
const userStatus = document.getElementById("userStatus");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const rankProgress = document.getElementById("rankProgress");
const rankPercent = document.getElementById("rankPercent");
const rankLabel = document.querySelector(".rank-label");

// ===== Utility Functions =====
function parseDateOnly(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

function formatTimeForDisplay(event) {
  if (event.isAllDay) return "All Day";
  let timeStr = event.time;
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
  if (!ev.recurrence) {
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
  return events
    .filter(ev => matchesDate(ev, targetDate))
    .map(ev => {
      const instance = { ...ev, instanceDate: targetDate.toISOString().slice(0, 10) };
      if (ev.date !== instance.instanceDate) {
        instance.date = instance.instanceDate;
        instance.isInstance = true;
      }
      return instance;
    });
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

function addXP(amount) {
  userXP += amount;
  updateRankBar();
  try {
    localStorage.setItem(`userXP_${currentUser || 'guest'}`, userXP.toString());
  } catch (e) {
    console.error("Failed to save XP:", e);
  }
}

function updateRankBar() {
  let currentThreshold = rankThresholds[0];
  let nextThreshold = rankThresholds[rankThresholds.length - 1];
  for (let i = 0; i < rankThresholds.length; i++) {
    if (userXP >= rankThresholds[i].xp) {
      currentThreshold = rankThresholds[i];
      userRank = currentThreshold.rank;
    }
    if (i < rankThresholds.length - 1 && userXP < rankThresholds[i + 1].xp) {
      nextThreshold = rankThresholds[i + 1];
      break;
    }
  }
  const progress = nextThreshold === currentThreshold
    ? 100
    : ((userXP - currentThreshold.xp) / (nextThreshold.xp - currentThreshold.xp)) * 100;
  rankProgress.style.width = `${Math.min(progress, 100)}%`;
  rankPercent.textContent = `${Math.round(progress)}%`;
  rankLabel.textContent = `Rank: ${userRank}`;
}

// ===== Authentication =====
function updateAuthUI() {
  if (currentUser) {
    userStatus.textContent = `Welcome, ${currentUser}`;
    userStatus.classList.remove("hidden");
    logInButton.classList.add("hidden");
    logOutButton.classList.remove("hidden");
  } else {
    userStatus.classList.add("hidden");
    logInButton.classList.remove("hidden");
    logOutButton.classList.add("hidden");
  }
}

function handleLogin(username, password) {
  try {
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    if (users[username] && users[username].password === password) {
      currentUser = username;
      localStorage.setItem("currentUser", username);
      authMessage.textContent = "Login successful!";
      authMessage.style.color = "#4caf50";
      setTimeout(() => {
        closeModal(loginModal);
        authMessage.textContent = "";
        updateAuthUI();
        loadData();
        updateView();
      }, 1000);
    } else {
      authMessage.textContent = "Invalid username or password";
    }
  } catch (e) {
    console.error("Login error:", e);
    authMessage.textContent = "Error during login";
  }
}

function handleRegister(username, password) {
  try {
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    if (users[username]) {
      authMessage.textContent = "Username already exists";
      return;
    }
    users[username] = { password, events: [], xp: 0 };
    localStorage.setItem("users", JSON.stringify(users));
    currentUser = username;
    localStorage.setItem("currentUser", username);
    authMessage.textContent = "Registration successful!";
    authMessage.style.color = "#4caf50";
    setTimeout(() => {
      closeModal(loginModal);
      authMessage.textContent = "";
      updateAuthUI();
      loadData();
      updateView();
    }, 1000);
  } catch (e) {
    console.error("Registration error:", e);
    authMessage.textContent = "Error during registration";
  }
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
    cell.onclick = () => {
      selectedDate = cellDate;
      currentView = "month";
      updateView();
    };
    cell.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectedDate = cellDate;
        currentView = "month";
        updateView();
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
  monthTitle.textContent = selectedDate.toLocaleDateString("default", { month: "long", year: "numeric" });
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  bigCalendarBody.innerHTML = ""; // Clear previous content
  let row = document.createElement("tr");
  for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.tabIndex = 0;
    const cellDate = new Date(year, month, day);
    cell.textContent = day;
    if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");
    cell.setAttribute("aria-label", `Day ${day} of ${monthTitle.textContent}`);
    cell.onclick = () => {
      selectedDate = cellDate;
      syncMiniCalendar();
      openEventModal(cellDate);
    };
    cell.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectedDate = cellDate;
        syncMiniCalendar();
        openEventModal(cellDate);
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
      div.onclick = e => {
        e.stopPropagation();
        openDetailsModal(event);
      };
      div.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetailsModal(event);
        }
      };
      cell.appendChild(div);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.classList.add("more-events");
      more.tabIndex = 0;
      more.textContent = `+${dayEvents.length - 3} more`;
      more.onclick = () => {
        selectedDate = cellDate;
        currentView = "week";
        updateView();
      };
      more.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectedDate = cellDate;
          currentView = "week";
          updateView();
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
  weekView.innerHTML = ""; // Clear previous content
  const weekNav = document.createElement("div");
  weekNav.classList.add("week-nav");
  weekNav.innerHTML = `
    <button id="prevWeek" aria-label="Previous Week">‹</button>
    <h2 id="weekTitle"></h2>
    <button id="nextWeek" aria-label="Next Week">›</button>
  `;
  weekView.appendChild(weekNav);
  const weekTitle = weekView.querySelector("#weekTitle");
  const prevWeek = weekView.querySelector("#prevWeek");
  const nextWeek = weekView.querySelector("#nextWeek");
  
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const isSmallScreen = window.matchMedia("(max-width: 480px)").matches;
  const daysToShow = isSmallScreen ? 3 : 7;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + daysToShow - 1);
  weekTitle.textContent = `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;

  const gridContainer = document.createElement("div");
  gridContainer.classList.add("week-grid-container");
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
      slot.onclick = () => {
        selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
        syncMiniCalendar();
        openEventModal(selectedDate);
      };
      slot.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
          syncMiniCalendar();
          openEventModal(selectedDate);
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
      evBox.onclick = e => {
        e.stopPropagation();
        openDetailsModal(event);
      };
      evBox.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetailsModal(event);
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
      evBox.onclick = e => {
        e.stopPropagation();
        openDetailsModal(event);
      };
      evBox.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetailsModal(event);
        }
      };
      col.appendChild(evBox);
    });
    gridContainer.appendChild(col);
  }
  weekView.appendChild(gridContainer);
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
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const scrollPosition = (currentHour + currentMinute / 60) * (isSmallScreen ? 50 : 60);
  gridContainer.scrollTop = scrollPosition - ((isSmallScreen ? 50 : 60) * 2);
}

// ===== Year View =====
function renderYearView() {
  yearTitle.textContent = selectedDate.getFullYear();
  yearGrid.innerHTML = ""; // Clear previous content
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
      if (getEventsForDate(cellDate).length) cell.classList.add("has-events");
      cell.onclick = () => {
        selectedDate = cellDate;
        currentView = "month";
        updateView();
      };
      cell.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectedDate = cellDate;
          currentView = "month";
          updateView();
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
  // Hide all views first
  monthView.classList.add("hidden");
  weekView.classList.add("hidden");
  yearView.classList.add("hidden");

  // Remove active class from all view buttons
  document.querySelectorAll(".view-btn").forEach(btn => btn.classList.remove("active"));

  // Add active class to the selected view button
  const activeBtn = document.querySelector(`.view-btn[data-view="${currentView}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // Show and render the selected view
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
function openEventModal(date, event = null) {
  editingEvent = event;
  eventModal.querySelector("h2").textContent = event ? "Edit Event" : "Create Event";
  eventForm.reset();
  eventDateInput.value = date.toISOString().slice(0, 10);
  eventColorPicker.value = event ? event.color : "#4caf50";
  eventColorPreset.value = event ? event.color : "#4caf50";
  allDayCheckbox.checked = event ? event.isAllDay : false;
  untilCheckbox.checked = event && event.endTime ? true : false;
  recurrenceTypeSelect.value = event && event.recurrence ? event.recurrence.type : "none";
  recurrenceIntervalInput.value = event && event.recurrence ? event.recurrence.interval : "1";
  recurrenceUntilInput.value = event && event.recurrence && event.recurrence.until ? event.recurrence.until : "";
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
}

function openDetailsModal(event) {
  activeEventId = event.id;
  detailsContent.innerHTML = `
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.date}</p>
    <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
    <p><strong>Details:</strong> ${event.details || "None"}</p>
    ${event.recurrence ? `
      <p><strong>Recurrence:</strong> Every ${event.recurrence.interval} ${event.recurrence.type}(s) until ${event.recurrence.until || "indefinite"}</p>
    ` : ""}
  `;
  detailsModal.classList.add("open");
}

function closeModal(modal) {
  modal.classList.remove("open");
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
  eventAMPMSelect.disabled = allDayDisabled;
  eventEndHourInput.disabled = allDayDisabled || !untilChecked;
  eventEndMinuteInput.disabled = allDayDisabled || !untilChecked;
  eventEndAMPMSelect.disabled = allDayDisabled || !untilChecked;
  if (use24Hour) {
    eventHourInput.min = 0;
    eventHourInput.max = 23;
    eventHourInput.placeholder = "HH (0-23)";
    eventEndHourInput.min = 0;
    eventEndHourInput.max = 23;
    eventEndHourInput.placeholder = "HH (0-23)";
    eventAMPMSelect.classList.add("hidden");
    eventEndAMPMSelect.classList.add("hidden");
  } else {
    eventHourInput.min = 1;
    eventHourInput.max = 12;
    eventHourInput.placeholder = "HH (1-12)";
    eventEndHourInput.min = 1;
    eventEndHourInput.max = 12;
    eventEndHourInput.placeholder = "HH (1-12)";
    eventAMPMSelect.classList.remove("hidden");
    eventEndAMPMSelect.classList.toggle("hidden", allDayDisabled || !untilChecked);
  }
}

function updateRecurrenceInputs() {
  const type = recurrenceTypeSelect.value;
  const isRecurring = type !== "none";
  recurrenceInputs.classList.toggle("hidden", !isRecurring);
  recurrenceIntervalInput.disabled = !isRecurring;
  recurrenceUntilInput.disabled = !isRecurring;
  recurrenceUnitSpan.textContent = isRecurring ? (type === "daily" ? "day(s)" : type === "weekly" ? "week(s)" : "month(s)") : "";
}

// ===== Event Handlers =====
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

eventForm.onsubmit = e => {
  e.preventDefault();
  if (!eventTitleInput.value.trim()) {
    showErrorMessage("Event title is required");
    return;
  }
  const eventDate = parseDateOnly(eventDateInput.value);
  if (!eventDate) {
    showErrorMessage("Invalid date");
    return;
  }
  let isAllDay = allDayCheckbox.checked;
  let timeStr = null;
  let endTimeStr = null;
  if (isAllDay) {
    timeStr = "00:00";
    endTimeStr = "23:59";
  } else {
    let startHour = parseInt(eventHourInput.value, 10);
    let startMinute = parseInt(eventMinuteInput.value, 10);
    if (isNaN(startHour) || isNaN(startMinute) || startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) {
      showErrorMessage("Invalid start time");
      return;
    }
    if (!use24Hour) {
      const ampm = eventAMPMSelect.value;
      if (ampm === "PM" && startHour < 12) startHour += 12;
      if (ampm === "AM" && startHour === 12) startHour = 0;
    }
    timeStr = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
    if (untilCheckbox.checked) {
      let endHour = parseInt(eventEndHourInput.value, 10);
      let endMinute = parseInt(eventEndMinuteInput.value, 10);
      if (isNaN(endHour) || isNaN(endMinute) || endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) {
        showErrorMessage("Invalid end time");
        return;
      }
      if (!use24Hour) {
        const endAmpm = eventEndAMPMSelect.value;
        if (endAmpm === "PM" && endHour < 12) endHour += 12;
        if (endAmpm === "AM" && endHour === 12) endHour = 0;
      }
      endTimeStr = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      const startMin = getTimeInMinutes(timeStr);
      const endMin = getTimeInMinutes(endTimeStr);
      if (endMin <= startMin) {
        showErrorMessage("End time must be after start time");
        return;
      }
    }
  }
  let recurrence = null;
  const recurrenceType = recurrenceTypeSelect.value;
  if (recurrenceType !== "none") {
    const interval = parseInt(recurrenceIntervalInput.value, 10);
    if (isNaN(interval) || interval < 1) {
      showErrorMessage("Invalid recurrence interval");
      return;
    }
    recurrence = {
      type: recurrenceType,
      interval,
      until: recurrenceUntilInput.value || null,
    };
  }
  const newEvent = {
    id: editingEvent ? editingEvent.id : Date.now().toString(),
    title: eventTitleInput.value.trim(),
    date: eventDateInput.value,
    time: timeStr,
    endTime: endTimeStr,
    isAllDay,
    color: eventColorPicker.value,
    details: eventDetailsInput.value.trim(),
    recurrence,
  };
  if (editingEvent) {
    const index = events.findIndex(e => e.id === editingEvent.id);
    if (index !== -1) events[index] = newEvent;
  } else {
    events.push(newEvent);
    addXP(10);
  }
  try {
    localStorage.setItem(`calendarEvents_${currentUser || 'guest'}`, JSON.stringify(events));
  } catch (e) {
    console.error("Failed to save events:", e);
    showErrorMessage("Error saving event");
    return;
  }
  closeModal(eventModal);
  updateView();
};

authForm.onsubmit = e => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    authMessage.textContent = "Username and password are required";
    return;
  }
  if (authSubmit.textContent === "Log In") {
    handleLogin(username, password);
  } else {
    handleRegister(username, password);
  }
};

toggleAuth.onclick = () => {
  const isLogin = authSubmit.textContent === "Log In";
  authSubmit.textContent = isLogin ? "Register" : "Log In";
  toggleAuth.textContent = isLogin ? "Switch to Login" : "Switch to Register";
  loginModal.querySelector("h2").textContent = isLogin ? "Register" : "Log In";
  authForm.reset();
  authMessage.textContent = "";
};

logInButton.onclick = () => {
  loginModal.classList.add("open");
  authSubmit.textContent = "Log In";
  toggleAuth.textContent = "Switch to Register";
  loginModal.querySelector("h2").textContent = "Log In";
};

logOutButton.onclick = () => {
  currentUser = null;
  events = [];
  userXP = 0;
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem(`calendarEvents_${currentUser || 'guest'}`);
    localStorage.removeItem(`userXP_${currentUser || 'guest'}`);
  } catch (e) {
    console.error("Failed to clear localStorage:", e);
  }
  updateAuthUI();
  updateRankBar();
  updateView();
};

deleteEventBtn.onclick = () => {
  if (activeEventId) {
    events = events.filter(e => e.id !== activeEventId);
    try {
      localStorage.setItem(`calendarEvents_${currentUser || 'guest'}`, JSON.stringify(events));
    } catch (e) {
      console.error("Failed to save events:", e);
    }
    closeModal(detailsModal);
    updateView();
  }
};

editEventBtn.onclick = () => {
  const event = events.find(e => e.id === activeEventId);
  if (event) {
    closeModal(detailsModal);
    openEventModal(parseDateOnly(event.date), event);
  }
};

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
  updateView();
};

nextMonthMain.onclick = () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  updateView();
};

prevYear.onclick = () => {
  selectedDate.setFullYear(selectedDate.getFullYear() - 1);
  updateView();
};

nextYear.onclick = () => {
  selectedDate.setFullYear(selectedDate.getFullYear() + 1);
  updateView();
};

createEventBtn.onclick = () => {
  openEventModal(selectedDate);
};

closeEventModal.onclick = () => closeModal(eventModal);
closeDetailsModal.onclick = () => closeModal(detailsModal);
closeLoginModal.onclick = () => closeModal(loginModal);

timeFormatToggle.onclick = () => {
  use24Hour = !use24Hour;
  timeFormatToggle.textContent = `Switch to ${use24Hour ? "12-Hour" : "24-Hour"}`;
  updateTimeInputs();
  updateView();
};

darkModeToggle.onclick = () => {
  document.body.classList.toggle("dark-mode");
  try {
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
  } catch (e) {
    console.error("Failed to save dark mode setting:", e);
  }
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
recurrenceTypeSelect.onchange = updateRecurrenceInputs;

settingsButton.onclick = () => {
  settingsPanel.classList.toggle("hidden");
};

document.querySelectorAll(".view-btn").forEach(btn => {
  btn.onclick = () => {
    currentView = btn.dataset.view;
    updateView();
  };
});

// ===== Initialize =====
loadData();
updateView();
updateRankBar();