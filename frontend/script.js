// ===== Global State =====
let events = [];
let authToken = null;
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false;
let currentView = "month";
let editingEvent = null;
let activeEventId = null;
let isLogin = true;
let currentXP = 35; // Rank bar XP
let maxXP = 100;   // XP needed for next rank
const API_BASE_URL = window.location.origin;

// ===== Persistent Login =====
try {
  const savedToken = localStorage.getItem("authToken");
  if (savedToken) {
    authToken = savedToken;
    logInButton.textContent = "Log Out";
    loadEvents();
  }
} catch (e) {
  console.error("Failed to access localStorage for authToken:", e);
}

// ===== Persistent Settings =====
try {
  const savedDarkMode = localStorage.getItem("darkMode");
  if (savedDarkMode === "true") document.body.classList.add("dark-mode");
  const savedButtonColor = localStorage.getItem("buttonColor");
  if (savedButtonColor) {
    buttonColorPicker.value = savedButtonColor;
    buttonColorPreset.value = savedButtonColor;
    updateButtonColor(savedButtonColor);
  }
} catch (e) {
  console.error("Failed to load settings:", e);
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
const endTimeInputs = document.getElementById("endTimeInputs");
const recurrenceInputs = document.getElementById("recurrenceInputs");
const detailsModal = document.getElementById("detailsModal");
const closeDetailsModal = detailsModal.querySelector(".close-btn");
const detailsContent = document.getElementById("detailsContent");
const deleteEventBtn = document.getElementById("deleteEventButton");
const editEventBtn = document.getElementById("editEventButton");
const loginModal = document.getElementById("loginModal");
const closeLoginModal = document.getElementById("closeLoginModal");
const logInButton = document.getElementById("logInButton");
const authForm = document.getElementById("authForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const authSubmit = document.getElementById("authSubmit");
const toggleAuth = document.getElementById("toggleAuth");
const authMessage = document.getElementById("authMessage");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const rankProgress = document.getElementById("rankProgress");
const rankPercent = document.getElementById("rankPercent");

// ===== Rank Bar XP System =====
function updateRankBar() {
  if (!rankProgress || !rankPercent) return;
  const percent = Math.min((currentXP / maxXP) * 100, 100);
  rankProgress.style.width = percent + "%";
  rankPercent.textContent = Math.round(percent) + "%";
}

function addXP(amount) {
  currentXP += amount;
  if (currentXP > maxXP) currentXP = maxXP;
  updateRankBar();
}

// Simulate XP gain (remove in production or tie to real events)
setInterval(() => {
  if (currentXP < maxXP) addXP(10);
}, 3000);

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

function showErrorMessage(message) {
  let errorDiv = document.getElementById("errorMessage");
  if (!errorDiv) {
    errorDiv = document.createElement("div");
    errorDiv.id = "errorMessage";
    eventModal.querySelector(".modal-content").prepend(errorDiv);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 3000);
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
  const { frequency, interval = 1, until } = ev.recurrence;
  if (evDate > date) return false;
  const untilDate = until ? parseDateOnly(until) : null;
  if (untilDate && untilDate < date) return false;
  const diffMs = date - evDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (frequency === "daily") {
    return diffDays % interval === 0;
  } else if (frequency === "weekly") {
    return date.getDay() === evDate.getDay() && (diffDays % (7 * interval) === 0);
  } else if (frequency === "monthly") {
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

function syncMiniCalendar() {
  currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar(currentDate);
}

function updateTimeInputs() {
  const allDayDisabled = allDayCheckbox.checked;
  const untilChecked = untilCheckbox.checked;
  timeInputs.classList.toggle("hidden", allDayDisabled);
  untilCheckbox.parentElement.classList.toggle("hidden", allDayDisabled);
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
  if (isRecurring) {
    recurrenceUnitSpan.textContent = type === "daily" ? "day(s)" : type === "weekly" ? "week(s)" : "month(s)";
  } else {
    recurrenceUnitSpan.textContent = "";
  }
}

// ===== Button Color Management =====
function updateButtonColor(color) {
  const root = document.documentElement;
  const isDarkMode = document.body.classList.contains("dark-mode");
  const hoverColor = adjustColorBrightness(color, isDarkMode ? 1.2 : 0.8);
  root.style.setProperty("--button-bg", color);
  root.style.setProperty("--button-hover-bg", hoverColor);
  root.style.setProperty("--button-dark-bg", color);
  root.style.setProperty("--button-dark-hover-bg", hoverColor);
  root.style.setProperty("--event-box-bg", color);
  root.style.setProperty("--event-box-dark-bg", adjustColorBrightness(color, 0.8));
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

// ===== API Functions =====
async function loadEvents() {
  if (!authToken) {
    events = [];
    updateView();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/events`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem("authToken");
        logInButton.textContent = "Log In";
        events = [];
        updateView();
        showErrorMessage("Session expired. Please log in again.");
        loginModal.classList.add("open");
        return;
      }
      throw new Error("Failed to load events");
    }
    events = await res.json();
    events = events.map(event => ({ ...event, id: event._id }));
    updateView();
  } catch (err) {
    console.error("Error loading events:", err);
    showErrorMessage("Failed to load events. Please try again.");
  }
}

async function saveEvent(eventData) {
  try {
    const method = editingEvent ? "PUT" : "POST";
    const url = editingEvent ? `${API_BASE_URL}/api/events/${editingEvent.id}` : `${API_BASE_URL}/api/events`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(eventData),
    });
    if (!res.ok) {
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem("authToken");
        logInButton.textContent = "Log In";
        showErrorMessage("Session expired. Please log in again.");
        loginModal.classList.add("open");
        return;
      }
      throw new Error("Failed to save event");
    }
    await loadEvents();
    eventModal.classList.remove("open");
    eventModal.setAttribute("aria-hidden", "true");
    addXP(10); // Add XP for creating/editing event
  } catch (err) {
    console.error("Error saving event:", err);
    showErrorMessage("Failed to save event. Please try again.");
  }
}

async function deleteEvent(eventId) {
  const event = events.find(e => e.id === eventId);
  if (event.recurrence && !confirm("This is a recurring event. Deleting will remove all instances. Continue?")) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem("authToken");
        logInButton.textContent = "Log In";
        showErrorMessage("Session expired. Please log in again.");
        loginModal.classList.add("open");
        return;
      }
      throw new Error("Failed to delete event");
    }
    await loadEvents();
    detailsModal.classList.remove("open");
    detailsModal.setAttribute("aria-hidden", "true");
    addXP(5); // Add XP for deleting event
  } catch (err) {
    console.error("Error deleting event:", err);
    showErrorMessage("Failed to delete event. Please try again.");
  }
}

async function loginOrRegister() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    authMessage.textContent = "Please fill in all fields";
    return;
  }
  try {
    const endpoint = isLogin ? "login" : "register";
    const res = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      authMessage.textContent = data.message || `Failed to ${isLogin ? "log in" : "register"}`;
      return;
    }
    authToken = data.token;
    try {
      localStorage.setItem("authToken", authToken);
    } catch (e) {
      console.error("Failed to save authToken:", e);
    }
    logInButton.textContent = "Log Out";
    loginModal.classList.remove("open");
    loginModal.setAttribute("aria-hidden", "true");
    await loadEvents();
  } catch (err) {
    console.error(`Error ${isLogin ? "logging in" : "registering"}:`, err);
    authMessage.textContent = `Failed to ${isLogin ? "log in" : "register"}. Please try again.`;
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
    const handleSelect = () => {
      selectedDate = cellDate;
      currentView = "month";
      updateView();
    };
    cell.addEventListener("click", handleSelect);
    cell.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    });
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
      selectedDate = cellDate;
      syncMiniCalendar();
      if (authToken) openEventModal(cellDate);
      else {
        showErrorMessage("Please log in to create events");
        loginModal.classList.add("open");
      }
    };
    cell.addEventListener("click", handleCellClick);
    cell.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCellClick();
      }
    });
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
      const handleEventClick = ev => {
        ev.stopPropagation();
        openDetailsModal(event);
      };
      div.addEventListener("click", handleEventClick);
      div.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      });
      cell.appendChild(div);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.classList.add("more-events");
      more.tabIndex = 0;
      more.textContent = `+${dayEvents.length - 3} more`;
      const handleMoreClick = () => {
        selectedDate = cellDate;
        currentView = "week";
        updateView();
      };
      more.addEventListener("click", handleMoreClick);
      more.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleMoreClick();
        }
      });
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
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekTitle.textContent = `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;
  weekView.innerHTML = "";
  weekView.appendChild(document.querySelector(".week-nav"));
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
  for (let d = 0; d < 7; d++) {
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
        selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
        syncMiniCalendar();
        if (authToken) openEventModal(selectedDate);
        else {
          showErrorMessage("Please log in to create events");
          loginModal.classList.add("open");
        }
      };
      slot.addEventListener("click", handleSlotClick);
      slot.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSlotClick();
        }
      });
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
        openDetailsModal(event);
      };
      evBox.addEventListener("click", handleEventClick);
      evBox.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      });
      allDayContainer.appendChild(evBox);
    });
    const timedEvents = dayEvents.filter(e => !e.isAllDay);
    const overlaps = timedEvents.map(event => ({
      event,
      startMin: getTimeInMinutes(event.time || "00:00"),
      endMin: getTimeInMinutes(event.endTime || (event.time ? `${parseInt(event.time.split(":")[0]) + 1}:00` : "01:00")),
    }));
    const lanes = [];
    overlaps.forEach((item, index) => {
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
    const hourSlotHeight = window.matchMedia("(max-width: 480px)").matches ? 50 : 60;
    const headerHeight = 30;
    const allDayContainerHeight = allDayContainer.children.length ? 30 : 0;
    timedEvents.forEach((event, index) => {
      const evBox = document.createElement("div");
      evBox.classList.add("event-box");
      evBox.tabIndex = 0;
      if (event.color) evBox.style.backgroundColor = event.color;
      evBox.textContent = `${event.title} (${formatTimeForDisplay(event)})`;
      const startMin = getTimeInMinutes(event.time || "00:00");
      const endMin = getTimeInMinutes(event.endTime || (event.time ? `${parseInt(event.time.split(":")[0]) + 1}:00` : "01:00"));
      const laneIndex = lanes.findIndex(lane => lane.some(item => item.event === event));
      const laneWidth = 100 / lanes.length;
      evBox.style.width = `calc(${laneWidth}% - 10px)`;
      evBox.style.left = `calc(${laneIndex * laneWidth}% + 5px)`;
      evBox.style.top = `${headerHeight + allDayContainerHeight + (startMin / 60) * hourSlotHeight}px`;
      evBox.style.height = `${((endMin - startMin) / 60) * hourSlotHeight - 4}px`;
      const handleEventClick = e => {
        e.stopPropagation();
        openDetailsModal(event);
      };
      evBox.addEventListener("click", handleEventClick);
      evBox.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleEventClick(e);
        }
      });
      col.appendChild(evBox);
    });
    gridContainer.appendChild(col);
  }
  weekView.appendChild(gridContainer);
}

// ===== Year View =====
function renderYearView() {
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
      if (getEventsForDate(cellDate).length) cell.classList.add("has-events");
      const handleCellClick = () => {
        selectedDate = cellDate;
        currentView = "month";
        updateView();
      };
      cell.addEventListener("click", handleCellClick);
      cell.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCellClick();
        }
      });
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
  monthView.classList.add("hidden");
  weekView.classList.add("hidden");
  yearView.classList.add("hidden");
  document.querySelectorAll(".view-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.view-btn[data-view="${currentView}"]`).classList.add("active");
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

// ===== Modal Management =====
function openEventModal(date) {
  editingEvent = null;
  eventModal.querySelector("h2").textContent = "Create Event";
  eventForm.reset();
  eventDateInput.value = date.toISOString().slice(0, 10);
  eventHourInput.value = "";
  eventMinuteInput.value = "";
  eventAMPMSelect.value = date.getHours() >= 12 ? "PM" : "AM";
  eventEndHourInput.value = "";
  eventEndMinuteInput.value = "";
  eventEndAMPMSelect.value = date.getHours() >= 12 ? "PM" : "AM";
  eventColorPicker.value = "#4caf50";
  eventColorPreset.value = "#4caf50";
  allDayCheckbox.checked = false;
  untilCheckbox.checked = false;
  recurrenceTypeSelect.value = "none";
  recurrenceIntervalInput.value = "1";
  recurrenceUntilInput.value = "";
  updateTimeInputs();
  updateRecurrenceInputs();
  eventModal.classList.add("open");
  eventModal.setAttribute("aria-hidden", "false");
  eventTitleInput.focus();
}

function openDetailsModal(event) {
  activeEventId = event.id;
  detailsContent.innerHTML = `
    <p><strong>Title:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${event.date}</p>
    <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
    ${event.details ? `<p><strong>Details:</strong> ${event.details}</p>` : ""}
    ${event.recurrence ? `<p><strong>Recurrence:</strong> ${event.recurrence.frequency} every ${event.recurrence.interval} ${event.recurrence.frequency === "daily" ? "day(s)" : event.recurrence.frequency === "weekly" ? "week(s)" : "month(s)"} until ${event.recurrence.until || "indefinite"}</p>` : ""}
  `;
  detailsModal.classList.add("open");
  detailsModal.setAttribute("aria-hidden", "false");
  editEventBtn.focus();
}

// ===== Event Handlers =====
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentView = btn.dataset.view;
    updateView();
  });
});

prevMonth.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderMiniCalendar(currentDate);
});

nextMonth.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderMiniCalendar(currentDate);
});

prevMonthMain.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  updateView();
});

nextMonthMain.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  updateView();
});

prevYear.addEventListener("click", () => {
  selectedDate.setFullYear(selectedDate.getFullYear() - 1);
  updateView();
});

nextYear.addEventListener("click", () => {
  selectedDate.setFullYear(selectedDate.getFullYear() + 1);
  updateView();
});

prevWeek.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() - 7);
  updateView();
});

nextWeek.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() + 7);
  updateView();
});

createEventBtn.addEventListener("click", () => {
  if (authToken) openEventModal(selectedDate);
  else {
    showErrorMessage("Please log in to create events");
    loginModal.classList.add("open");
  }
});

timeFormatToggle.addEventListener("click", () => {
  use24Hour = !use24Hour;
  timeFormatToggle.textContent = `Switch to ${use24Hour ? "12-Hour" : "24-Hour"}`;
  updateTimeInputs();
  updateView();
});

darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  try {
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
  } catch (e) {
    console.error("Failed to save dark mode setting:", e);
  }
  updateButtonColor(buttonColorPicker.value);
});

buttonColorPicker.addEventListener("input", () => {
  buttonColorPreset.value = buttonColorPicker.value;
  updateButtonColor(buttonColorPicker.value);
});

buttonColorPreset.addEventListener("change", () => {
  buttonColorPicker.value = buttonColorPreset.value;
  updateButtonColor(buttonColorPreset.value);
});

eventColorPicker.addEventListener("input", () => {
  eventColorPreset.value = eventColorPicker.value;
});

eventColorPreset.addEventListener("change", () => {
  eventColorPicker.value = eventColorPreset.value;
});

allDayCheckbox.addEventListener("change", updateTimeInputs);
untilCheckbox.addEventListener("change", updateTimeInputs);
recurrenceTypeSelect.addEventListener("change", updateRecurrenceInputs);

eventForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!authToken) {
    showErrorMessage("Please log in to create events");
    loginModal.classList.add("open");
    return;
  }
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const color = eventColorPicker.value;
  const isAllDay = allDayCheckbox.checked;
  let time = null;
  let endTime = null;
  if (!isAllDay) {
    let hour = parseInt(eventHourInput.value);
    const minute = parseInt(eventMinuteInput.value) || 0;
    if (!use24Hour) {
      if (eventAMPMSelect.value === "PM" && hour < 12) hour += 12;
      if (eventAMPMSelect.value === "AM" && hour === 12) hour = 0;
    }
    if (isNaN(hour) || isNaN(minute)) {
      showErrorMessage("Please enter valid time values");
      return;
    }
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (untilCheckbox.checked) {
      let endHour = parseInt(eventEndHourInput.value);
      const endMinute = parseInt(eventEndMinuteInput.value) || 0;
      if (!use24Hour) {
        if (eventEndAMPMSelect.value === "PM" && endHour < 12) endHour += 12;
        if (eventEndAMPMSelect.value === "AM" && endHour === 12) endHour = 0;
      }
      if (isNaN(endHour) || isNaN(endMinute)) {
        showErrorMessage("Please enter valid end time values");
        return;
      }
      endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      if (getTimeInMinutes(time) >= getTimeInMinutes(endTime)) {
        showErrorMessage("End time must be after start time");
        return;
      }
    }
  }
  const details = eventDetailsInput.value.trim();
  const recurrenceType = recurrenceTypeSelect.value;
  const eventData = {
    title,
    date,
    color,
    isAllDay,
    time,
    endTime,
    details,
  };
  if (recurrenceType !== "none") {
    eventData.recurrence = {
      frequency: recurrenceType,
      interval: parseInt(recurrenceIntervalInput.value) || 1,
      until: recurrenceUntilInput.value || undefined,
    };
  }
  await saveEvent(eventData);
});

closeEventModal.addEventListener("click", () => {
  eventModal.classList.remove("open");
  eventModal.setAttribute("aria-hidden", "true");
});

closeDetailsModal.addEventListener("click", () => {
  detailsModal.classList.remove("open");
  detailsModal.setAttribute("aria-hidden", "true");
});

editEventBtn.addEventListener("click", () => {
  const event = events.find(e => e.id === activeEventId);
  if (!event) return;
  editingEvent = event;
  eventModal.querySelector("h2").textContent = "Edit Event";
  eventTitleInput.value = event.title;
  eventDateInput.value = event.date;
  eventColorPicker.value = event.color || "#4caf50";
  eventColorPreset.value = event.color || "#4caf50";
  allDayCheckbox.checked = event.isAllDay;
  eventDetailsInput.value = event.details || "";
  recurrenceTypeSelect.value = event.recurrence ? event.recurrence.frequency : "none";
  recurrenceIntervalInput.value = event.recurrence ? event.recurrence.interval : "1";
  recurrenceUntilInput.value = event.recurrence && event.recurrence.until ? event.recurrence.until : "";
  if (!event.isAllDay && event.time) {
    let [hour, minute] = event.time.split(":").map(Number);
    if (!use24Hour) {
      eventAMPMSelect.value = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
    }
    eventHourInput.value = hour;
    eventMinuteInput.value = minute;
    untilCheckbox.checked = !!event.endTime;
    if (event.endTime) {
      [hour, minute] = event.endTime.split(":").map(Number);
      if (!use24Hour) {
        eventEndAMPMSelect.value = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
      }
      eventEndHourInput.value = hour;
      eventEndMinuteInput.value = minute;
    }
  } else {
    eventHourInput.value = "";
    eventMinuteInput.value = "";
    eventAMPMSelect.value = "AM";
    eventEndHourInput.value = "";
    eventEndMinuteInput.value = "";
    eventEndAMPMSelect.value = "AM";
    untilCheckbox.checked = false;
  }
  updateTimeInputs();
  updateRecurrenceInputs();
  eventModal.classList.add("open");
  eventModal.setAttribute("aria-hidden", "false");
  eventTitleInput.focus();
});

deleteEventBtn.addEventListener("click", () => {
  if (activeEventId) deleteEvent(activeEventId);
});

logInButton.addEventListener("click", () => {
  if (authToken) {
    authToken = null;
    try {
      localStorage.removeItem("authToken");
    } catch (e) {
      console.error("Failed to remove authToken:", e);
    }
    logInButton.textContent = "Log In";
    events = [];
    updateView();
    showErrorMessage("You have been logged out.");
  } else {
    isLogin = true;
    authForm.reset();
    authSubmit.textContent = "Log In";
    toggleAuth.textContent = "Switch to Register";
    authMessage.textContent = "";
    loginModal.classList.add("open");
    loginModal.setAttribute("aria-hidden", "false");
    usernameInput.focus();
  }
});

closeLoginModal.addEventListener("click", () => {
  loginModal.classList.remove("open");
  loginModal.setAttribute("aria-hidden", "true");
});

authForm.addEventListener("submit", async e => {
  e.preventDefault();
  await loginOrRegister();
});

toggleAuth.addEventListener("click", () => {
  isLogin = !isLogin;
  authSubmit.textContent = isLogin ? "Log In" : "Register";
  toggleAuth.textContent = isLogin ? "Switch to Register" : "Switch to Log In";
  authMessage.textContent = "";
});

settingsButton.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", () => {
  updateRankBar();
  updateView();
  updateTimeInputs();
});