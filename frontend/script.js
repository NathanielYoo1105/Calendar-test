// ===== Global State =====
let events = [];
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false;
let currentView = "month";
let editingEvent = null;
let activeEventId = null;
let userXP = 0;
let userRank = "Bronze";
const rankThresholds = [
  { rank: "Bronze", xp: 0 },
  { rank: "Silver", xp: 100 },
  { rank: "Gold", xp: 250 },
  { rank: "Platinum", xp: 500 },
];

// Load events, XP, and settings from localStorage
try {
  const savedEvents = localStorage.getItem("calendarEvents");
  if (savedEvents) events = JSON.parse(savedEvents);
  const savedXP = localStorage.getItem("userXP");
  if (savedXP) userXP = parseInt(savedXP, 10);
  const savedDarkMode = localStorage.getItem("darkMode");
  if (savedDarkMode === "true") document.body.classList.add("dark-mode");
  const savedButtonColor = localStorage.getItem("buttonColor");
  if (savedButtonColor) {
    buttonColorPicker.value = savedButtonColor;
    buttonColorPreset.value = savedButtonColor;
    updateButtonColor(savedButtonColor);
  }
} catch (e) {
  console.error("Failed to load from localStorage:", e);
  showErrorMessage("Error loading data. Local storage may be disabled.");
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
const logInButton = document.getElementById("logInButton");
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
  }, 2000);
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

function syncMiniCalendar() {
  currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar(currentDate);
}

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
  if (isRecurring) {
    recurrenceUnitSpan.textContent = type === "daily" ? "day(s)" : type === "weekly" ? "week(s)" : "month(s)";
  } else {
    recurrenceUnitSpan.textContent = "";
  }
}

// ===== Button Color Management =====
function loadButtonColor() {
  try {
    const savedColor = localStorage.getItem("buttonColor");
    if (savedColor) {
      buttonColorPicker.value = savedColor;
      buttonColorPreset.value = savedColor;
      updateButtonColor(savedColor);
    }
  } catch (e) {
    console.error("Failed to load button color:", e);
  }
}

function updateButtonColor(color) {
  const root = document.documentElement;
  const isDarkMode = document.body.classList.contains("dark-mode");
  const hoverColor = adjustColorBrightness(color, isDarkMode ? 1.2 : 0.8);
  root.style.setProperty("--button-bg", color);
  root.style.setProperty("--button-hover-bg", hoverColor);
  root.style.setProperty("--button-dark-bg", color);
  root.style.setProperty("--button-dark-hover-bg", hoverColor);
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

// ===== Rank and XP System =====
function updateRankBar() {
  let currentThreshold = rankThresholds[0];
  let nextThreshold = rankThresholds[1] ? rankThresholds[1] : rankThresholds[0];
  for (let i = 0; i < rankThresholds.length - 1; i++) {
    if (userXP >= rankThresholds[i].xp && userXP < rankThresholds[i + 1].xp) {
      currentThreshold = rankThresholds[i];
      nextThreshold = rankThresholds[i + 1];
      break;
    } else if (userXP >= rankThresholds[rankThresholds.length - 1].xp) {
      currentThreshold = rankThresholds[rankThresholds.length - 1];
      nextThreshold = currentThreshold; // Max rank
      break;
    }
  }
  userRank = currentThreshold.rank;
  const progress = (userXP - currentThreshold.xp) / (nextThreshold.xp - currentThreshold.xp) * 100;
  rankProgress.style.width = `${Math.min(progress, 100)}%`;
  rankPercent.textContent = `${Math.round(progress)}%`;
  rankLabel.textContent = `Rank: ${userRank}`;
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
      openEventModal(cellDate);
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
  const isSmallScreen = window.matchMedia("(max-width: 480px)").matches;
  const daysToShow = isSmallScreen ? 3 : 7;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + daysToShow - 1);
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
        selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
        syncMiniCalendar();
        openEventModal(selectedDate);
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
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const scrollPosition = (currentHour + currentMinute / 60) * (isSmallScreen ? 50 : 60);
  gridContainer.scrollTop = scrollPosition - ((isSmallScreen ? 50 : 60) * 2);
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
      if (cellDate.toDateString() === new Date().toDateString()) cell.classList.add("today");
      if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");
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

function closeModal(modal) {
  modal.classList.remove("open");
}

closeEventModal.addEventListener("click", () => closeModal(eventModal));
closeDetailsModal.addEventListener("click", () => closeModal(detailsModal));
closeLoginModal.addEventListener("click", () => closeModal(loginModal));

[closeEventModal, closeDetailsModal, closeLoginModal].forEach(btn => {
  btn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeModal(btn.closest(".modal"));
    }
  });
});

// ===== Event Handling =====
eventForm.addEventListener("submit", e => {
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
    const until = recurrenceUntilInput.value || null;
    if (until && parseDateOnly(until) < eventDate) {
      showErrorMessage("Recurrence end date must be after start date");
      return;
    }
    recurrence = { type: recurrenceType, interval, until };
  }
  const eventData = {
    id: editingEvent ? editingEvent.id : Date.now(),
    title: eventTitleInput.value.trim(),
    date: eventDateInput.value,
    time: timeStr,
    endTime: endTimeStr,
    isAllDay: isAllDay,
    details: eventDetailsInput.value.trim(),
    recurrence,
    color: eventColorPicker.value,
  };
  if (editingEvent) {
    const index = events.findIndex(ev => ev.id === editingEvent.id);
    if (index !== -1) events[index] = eventData;
  } else {
    events.push(eventData);
    addXP(10);
  }
  try {
    localStorage.setItem("calendarEvents", JSON.stringify(events));
  } catch (e) {
    console.error("Failed to save events:", e);
    showErrorMessage("Unable to save events. They will not persist.");
  }
  updateView();
  closeModal(eventModal);
});

// ===== Details Modal =====
function openDetailsModal(event) {
  activeEventId = event.isInstance ? event.id : event.id;
  detailsContent.innerHTML = `
    <h3>${event.title}</h3>
    <p><strong>Date:</strong> <time datetime="${event.instanceDate || event.date}">${event.instanceDate || event.date}</time></p>
    <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
    <p><strong>Color:</strong> <span style="display: inline-block; width: 20px; height: 20px; background-color: ${event.color || (document.body.classList.contains("dark-mode") ? "#66bb6a" : "#4caf50")}; vertical-align: middle; border: 1px solid #000;"></span></p>
    <p>${event.details || "No details provided"}</p>
    ${event.recurrence ? '<p><strong>Recurring:</strong> Yes</p>' : ''}
  `;
  detailsModal.classList.add("open");
}

// ===== Delete Event =====
deleteEventBtn.addEventListener("click", () => {
  if (activeEventId) {
    events = events.filter(e => e.id !== activeEventId);
    try {
      localStorage.setItem("calendarEvents", JSON.stringify(events));
    } catch (e) {
      console.error("Failed to save events:", e);
      showErrorMessage("Unable to save events. They will not persist.");
    }
    updateView();
    closeModal(detailsModal);
  }
});

// ===== Edit Event =====
editEventBtn.addEventListener("click", () => {
  const event = events.find(e => e.id === activeEventId);
  if (event) {
    closeModal(detailsModal);
    const date = parseDateOnly(event.date);
    if (date) openEventModal(date, event);
  }
});

// ===== View Selection =====
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentView = btn.dataset.view;
    updateView();
  });
});

// ===== Navigation Events =====
prevMonth.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  syncMiniCalendar();
  updateView();
});

nextMonth.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  syncMiniCalendar();
  updateView();
});

prevMonthMain.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  syncMiniCalendar();
  updateView();
});

nextMonthMain.addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  syncMiniCalendar();
  updateView();
});

prevYear.addEventListener("click", () => {
  selectedDate.setFullYear(selectedDate.getFullYear() - 1);
  syncMiniCalendar();
  updateView();
});

nextYear.addEventListener("click", () => {
  selectedDate.setFullYear(selectedDate.getFullYear() + 1);
  syncMiniCalendar();
  updateView();
});

prevWeek.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() - 7);
  syncMiniCalendar();
  updateView();
});

nextWeek.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() + 7);
  syncMiniCalendar();
  updateView();
});

// ===== Create Event Button =====
createEventBtn.addEventListener("click", () => {
  syncMiniCalendar();
  openEventModal(selectedDate);
});

// ===== Log In Button =====
logInButton.addEventListener("click", () => {
  loginModal.classList.add("open");
});

// ===== Time Format Toggle =====
timeFormatToggle.addEventListener("click", () => {
  use24Hour = !use24Hour;
  timeFormatToggle.textContent = use24Hour ? "Switch to AM/PM" : "Switch to 24-Hour";
  updateTimeInputs();
  updateView();
});

// ===== Dark Mode Toggle =====
darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  try {
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode").toString());
  } catch (e) {
    console.error("Failed to save dark mode setting:", e);
  }
  updateView();
});

// ===== Button Color Management =====
buttonColorPicker.addEventListener("input", () => {
  const color = buttonColorPicker.value;
  buttonColorPreset.value = color;
  updateButtonColor(color);
});

buttonColorPreset.addEventListener("change", () => {
  const color = buttonColorPreset.value;
  buttonColorPicker.value = color;
  updateButtonColor(color);
});

// ===== Event Color Management =====
eventColorPicker.addEventListener("input", () => {
  const color = eventColorPicker.value;
  eventColorPreset.value = color;
});

eventColorPreset.addEventListener("change", () => {
  const color = eventColorPreset.value;
  eventColorPicker.value = color;
});

// ===== Checkbox and Select Events =====
allDayCheckbox.addEventListener("change", updateTimeInputs);
untilCheckbox.addEventListener("change", updateTimeInputs);
recurrenceTypeSelect.addEventListener("change", updateRecurrenceInputs);

// ===== Settings Toggle =====
settingsButton.addEventListener("click", () => {
  document.querySelector(".mini-calendar").classList.toggle("hidden");
  settingsPanel.classList.toggle("hidden");
});

// ===== Init =====
updateRankBar();
syncMiniCalendar();
updateView();
updateTimeInputs();
updateRecurrenceInputs();
loadButtonColor();