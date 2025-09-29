// ===== Global State =====
let events = [];
try {
  events = JSON.parse(localStorage.getItem("calendarEvents")) || [];
} catch (e) {
  console.error("Failed to load events:", e);
  alert("Error loading events. Local storage may be disabled.");
}
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false;
let currentView = "week";

// ===== DOM Elements =====
const monthYear = document.getElementById("monthYear");
const calendarBody = document.getElementById("calendarBody");
const bigCalendarBody = document.getElementById("bigCalendarBody");
const yearTitle = document.getElementById("yearTitle");
const yearGrid = document.getElementById("yearGrid");

const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const yearView = document.getElementById("yearView");
const createEventBtn = document.getElementById("createEventButton");
const timeFormatToggle = document.getElementById("timeFormatToggle");

// Modals
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

const detailsModal = document.getElementById("detailsModal");
const closeDetailsModal = detailsModal.querySelector(".close-btn");
const detailsContent = document.getElementById("detailsContent");
const deleteEventBtn = document.getElementById("deleteEventButton");
const editEventBtn = document.getElementById("editEventButton");

const loginModal = document.getElementById("loginModal");
const closeLoginModal = loginModal.querySelector(".close-btn");
const logInButton = document.getElementById("logInButton");

let activeEventId = null;
let editingEvent = null;

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

function getEventsByDate() {
  const eventMap = {};
  events.forEach(event => {
    const dateStr = parseDateOnly(event.date)?.toDateString();
    if (dateStr) {
      if (!eventMap[dateStr]) eventMap[dateStr] = [];
      eventMap[dateStr].push(event);
    }
  });
  return eventMap;
}

function syncMiniCalendar() {
  currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar(currentDate);
}

function updateTimeInputs() {
  const allDayDisabled = allDayCheckbox.checked;
  const untilDisabled = !untilCheckbox.checked || allDayDisabled;

  eventHourInput.disabled = allDayDisabled;
  eventHourInput.style.display = allDayDisabled ? "none" : "inline-block";
  eventMinuteInput.disabled = allDayDisabled;
  eventMinuteInput.style.display = allDayDisabled ? "none" : "inline-block";
  eventAMPMSelect.disabled = allDayDisabled;
  eventAMPMSelect.style.display = allDayDisabled || use24Hour ? "none" : "inline-block";
  untilCheckbox.disabled = allDayDisabled;
  untilCheckbox.style.display = allDayDisabled ? "none" : "inline-block";
  eventEndHourInput.disabled = untilDisabled;
  eventEndHourInput.style.display = untilDisabled ? "none" : "inline-block";
  eventEndMinuteInput.disabled = untilDisabled;
  eventEndMinuteInput.style.display = untilDisabled ? "none" : "inline-block";
  eventEndAMPMSelect.disabled = untilDisabled;
  eventEndAMPMSelect.style.display = untilDisabled || use24Hour ? "none" : "inline-block";

  if (use24Hour) {
    eventHourInput.min = 0;
    eventHourInput.max = 23;
    eventHourInput.placeholder = "HH (0-23)";
    eventEndHourInput.min = 0;
    eventEndHourInput.max = 23;
    eventEndHourInput.placeholder = "HH (0-23)";
  } else {
    eventHourInput.min = 1;
    eventHourInput.max = 12;
    eventHourInput.placeholder = "HH (1-12)";
    eventEndHourInput.min = 1;
    eventEndHourInput.max = 12;
    eventEndHourInput.placeholder = "HH (1-12)";
  }
}

// ===== Mini Calendar =====
function renderMiniCalendar(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  monthYear.textContent = date.toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  });

  calendarBody.innerHTML = "";
  let row = document.createElement("tr");

  for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    cell.textContent = day;
    const cellDate = new Date(year, month, day);

    if (cellDate.toDateString() === new Date().toDateString()) cell.classList.add("today");
    if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");

    cell.setAttribute("aria-label", `Day ${day} of ${monthYear.textContent}`);
    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      currentView = "month";
      updateView();
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
  const eventMap = getEventsByDate();
  const monthTitle = document.getElementById("monthTitle");
  monthTitle.textContent = selectedDate.toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  });

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  bigCalendarBody.innerHTML = "";
  let row = document.createElement("tr");

  for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("td");
    const cellDate = new Date(year, month, day);
    cell.textContent = day;
    if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");

    cell.setAttribute("aria-label", `Day ${day} of ${monthTitle.textContent}`);
    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      syncMiniCalendar();
      openEventModal(cellDate);
    });

    const dayEvents = (eventMap[cellDate.toDateString()] || []).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    });

    dayEvents.slice(0, 3).forEach(event => {
      const div = document.createElement("div");
      div.classList.add("month-event");
      if (event.isAllDay) div.classList.add("all-day");
      div.textContent = `${event.title} (${formatTimeForDisplay(event)})`;
      div.setAttribute("aria-label", `Event: ${event.title} on ${event.date} at ${formatTimeForDisplay(event)}`);
      div.addEventListener("click", ev => {
        ev.stopPropagation();
        openDetailsModal(event);
      });
      cell.appendChild(div);
    });

    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.classList.add("more-events");
      more.textContent = `+${dayEvents.length - 3} more`;
      more.addEventListener("click", () => {
        selectedDate = cellDate;
        currentView = "week";
        updateView();
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
  weekView.innerHTML = "";

  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const nav = document.createElement("div");
  nav.classList.add("week-nav");
  nav.innerHTML = `
    <button id="prevWeek" aria-label="Previous Week">‹</button>
    <h2>${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}</h2>
    <button id="nextWeek" aria-label="Next Week">›</button>
  `;
  weekView.appendChild(nav);

  const eventMap = getEventsByDate();
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

  const isSmallScreen = window.matchMedia("(max-width: 480px)").matches;
  const daysToShow = isSmallScreen ? 3 : 7;

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
      slot.addEventListener("click", () => {
        selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
        syncMiniCalendar();
        openEventModal(selectedDate);
      });
      slots.appendChild(slot);
    }
    col.appendChild(slots);

    const dayEvents = (eventMap[dayDate.toDateString()] || []).sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    });

    dayEvents.filter(e => e.isAllDay).forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("all-day-event");
      evBox.textContent = event.title;
      evBox.addEventListener("click", e => {
        e.stopPropagation();
        openDetailsModal(event);
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

    const hourSlotHeight = isSmallScreen ? 50 : 60; // Match CSS heights
    timedEvents.forEach((event, index) => {
      const evBox = document.createElement("div");
      evBox.classList.add("event-box");
      evBox.textContent = `${event.title} (${formatTimeForDisplay(event)})`;

      const startMin = getTimeInMinutes(event.time || "00:00");
      const endMin = event.endTime ? getTimeInMinutes(event.endTime) : startMin + 60;
      evBox.style.top = `${(startMin / 60) * hourSlotHeight}px`;
      evBox.style.height = `${((endMin - startMin) / 60) * hourSlotHeight}px`;

      const laneIndex = lanes.findIndex(lane => lane.some(item => item.event === event));
      const laneWidth = 100 / Math.max(1, lanes.length);
      evBox.style.width = `${laneWidth}%`;
      evBox.style.left = `${laneIndex * laneWidth}%`;

      evBox.addEventListener("click", e => {
        e.stopPropagation();
        openDetailsModal(event);
      });

      col.appendChild(evBox);
    });

    gridContainer.appendChild(col);
  }
  weekView.appendChild(gridContainer);

  // Auto-scroll to current time
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const scrollPosition = (currentHour + currentMinute / 60) * hourSlotHeight;
  gridContainer.scrollTop = scrollPosition - (hourSlotHeight * 2); // Center current time, offset by 2 hours

  const prevWeekBtn = document.getElementById("prevWeek");
  const nextWeekBtn = document.getElementById("nextWeek");
  if (prevWeekBtn) {
    prevWeekBtn.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() - 7);
      syncMiniCalendar();
      updateView();
    });
  }
  if (nextWeekBtn) {
    nextWeekBtn.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() + 7);
      syncMiniCalendar();
      updateView();
    });
  }
}

// ===== Year View =====
function renderYearView() {
  const eventMap = getEventsByDate();
  const year = selectedDate.getFullYear();
  yearTitle.textContent = year;
  yearGrid.innerHTML = "";

  for (let month = 0; month < 12; month++) {
    const monthDiv = document.createElement("div");
    monthDiv.classList.add("year-month");

    const monthHeader = document.createElement("h3");
    monthHeader.textContent = new Date(year, month).toLocaleDateString("default", { month: "long" });
    monthDiv.appendChild(monthHeader);

    const table = document.createElement("table");
    table.classList.add("calendar-grid");
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
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    let row = document.createElement("tr");

    for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement("td");
      cell.textContent = day;
      const cellDate = new Date(year, month, day);

      if (cellDate.toDateString() === new Date().toDateString()) cell.classList.add("today");
      if (cellDate.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");

      if (eventMap[cellDate.toDateString()]?.length > 0) cell.classList.add("has-events");

      cell.addEventListener("click", () => {
        selectedDate = cellDate;
        currentView = "month";
        updateView();
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
  monthView.classList.remove("active");
  weekView.classList.remove("active");
  yearView.classList.remove("active");

  document.querySelectorAll(".view-btn").forEach(btn => btn.classList.remove("active"));

  if (currentView === "month") {
    monthView.classList.remove("hidden");
    monthView.classList.add("active");
    document.querySelector(".view-btn[data-view='month']").classList.add("active");
    renderMonthView();
  } else if (currentView === "week") {
    weekView.classList.remove("hidden");
    weekView.classList.add("active");
    document.querySelector(".view-btn[data-view='week']").classList.add("active");
    renderWeekView();
  } else if (currentView === "year") {
    yearView.classList.remove("hidden");
    yearView.classList.add("active");
    document.querySelector(".view-btn[data-view='year']").classList.add("active");
    renderYearView();
  }
  syncMiniCalendar();
}

// ===== Modals =====
function openEventModal(date, event = null) {
  eventForm.reset();
  eventDateInput.value = date.toISOString().slice(0, 10);
  allDayCheckbox.checked = false;
  untilCheckbox.checked = false;

  if (event) {
    editingEvent = event;
    eventTitleInput.value = event.title;
    eventDateInput.value = event.date;
    eventDetailsInput.value = event.details || "";
    allDayCheckbox.checked = event.isAllDay || false;

    let [hour, minute] = (event.time || "00:00").split(":").map(Number);
    eventMinuteInput.value = minute;
    if (!use24Hour) {
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      eventAMPMSelect.value = ampm;
    }
    eventHourInput.value = hour;

    if (event.endTime) {
      untilCheckbox.checked = true;
      let [endHour, endMinute] = event.endTime.split(":").map(Number);
      eventEndMinuteInput.value = endMinute;
      if (!use24Hour) {
        const endAmpm = endHour >= 12 ? "PM" : "AM";
        endHour = endHour % 12 || 12;
        eventEndAMPMSelect.value = endAmpm;
      }
      eventEndHourInput.value = endHour;
    }
  } else {
    editingEvent = null;
  }
  updateTimeInputs();
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

  const eventData = {
    id: editingEvent ? editingEvent.id : Date.now(),
    title: eventTitleInput.value.trim(),
    date: eventDateInput.value,
    time: timeStr,
    endTime: endTimeStr,
    isAllDay: isAllDay,
    details: eventDetailsInput.value.trim(),
  };

  if (editingEvent) {
    const index = events.findIndex(ev => ev.id === editingEvent.id);
    if (index !== -1) {
      events[index] = eventData;
    }
  } else {
    events.push(eventData);
  }

  saveEvents();
  updateView();
  closeModal(eventModal);
});

// ===== Details Modal =====
function openDetailsModal(event) {
  activeEventId = event.id;
  detailsContent.innerHTML = `
    <h3>${event.title}</h3>
    <p><strong>Date:</strong> <time datetime="${event.date}">${event.date}</time></p>
    <p><strong>Time:</strong> ${formatTimeForDisplay(event)}</p>
    <p>${event.details || "No details provided"}</p>
  `;
  detailsModal.classList.add("open");
}

// ===== Delete Event =====
deleteEventBtn.addEventListener("click", () => {
  if (activeEventId) {
    events = events.filter(e => e.id !== activeEventId);
    saveEvents();
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

// ===== Create Event Button =====
createEventBtn.addEventListener("click", () => {
  syncMiniCalendar();
  openEventModal(selectedDate);
});

// ===== Time Format Toggle =====
timeFormatToggle.addEventListener("click", () => {
  use24Hour = !use24Hour;
  timeFormatToggle.textContent = use24Hour ? "Switch to AM/PM" : "Switch to 24-Hour";
  updateTimeInputs();
  updateView();
});

// ===== Checkbox Events =====
allDayCheckbox.addEventListener("change", updateTimeInputs);
untilCheckbox.addEventListener("change", updateTimeInputs);

// ===== Local Storage =====
function saveEvents() {
  try {
    localStorage.setItem("calendarEvents", JSON.stringify(events));
  } catch (e) {
    console.error("Failed to save events:", e);
    showErrorMessage("Unable to save events. They will not persist after closing the browser.");
  }
}

// ===== Month Navigation =====
document.getElementById("prevMonth").addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  syncMiniCalendar();
  updateView();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  syncMiniCalendar();
  updateView();
});

// ===== Log In Button =====
logInButton.addEventListener("click", () => {
  loginModal.classList.add("open");
});

// ===== Init =====
syncMiniCalendar();
updateView();
updateTimeInputs();

// =======================
// Rank Bar XP System
// =======================

// Example: progress towards next rank
let currentXP = 35; // Current experience points
let maxXP = 100;    // XP needed to reach next rank

function updateRankBar() {
  const rankProgress = document.getElementById("rankProgress");
  const rankPercent = document.getElementById("rankPercent");

  if (!rankProgress || !rankPercent) return; // Prevents errors if elements are missing

  const percent = Math.min((currentXP / maxXP) * 100, 100); // Calculate percentage
  rankProgress.style.width = percent + "%";
  rankPercent.textContent = Math.round(percent) + "%";
}

// Simulate gaining XP
function addXP(amount) {
  currentXP += amount;
  if (currentXP > maxXP) currentXP = maxXP; // Prevent overflow
  updateRankBar();
}

// Initialize the bar when page loads
document.addEventListener("DOMContentLoaded", () => {
  updateRankBar();
});

// Example: Automatically increase XP every 3 seconds
setInterval(() => {
  if (currentXP < maxXP) {
    addXP(10);
  }
}, 3000);