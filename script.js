// script.js (updated with fixed and improved All Day & Until features, dynamic durations, and week->month->year cycle)

// ===== Global State =====
let events = JSON.parse(localStorage.getItem("calendarEvents")) || [];
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false; // false = AM/PM, true = 24-hour
let currentView = "week"; // Track current view: "month", "week", or "year"

// ===== DOM Elements =====
const monthYear = document.getElementById("monthYear");
const calendarBody = document.getElementById("calendarBody");
const bigCalendarBody = document.getElementById("bigCalendarBody");
const yearTitle = document.getElementById("yearTitle");
const yearGrid = document.getElementById("yearGrid");

const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const yearView = document.getElementById("yearView");
const viewToggle = document.getElementById("viewToggle");
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

function updateTimeInputs() {
  const allDayDisabled = allDayCheckbox.checked;
  const untilDisabled = !untilCheckbox.checked || allDayDisabled;

  eventHourInput.disabled = allDayDisabled;
  eventMinuteInput.disabled = allDayDisabled;
  eventAMPMSelect.disabled = allDayDisabled;
  untilCheckbox.disabled = allDayDisabled;
  eventEndHourInput.disabled = untilDisabled;
  eventEndMinuteInput.disabled = untilDisabled;
  eventEndAMPMSelect.disabled = untilDisabled;

  eventAMPMSelect.style.display = use24Hour ? "none" : "inline-block";
  eventEndAMPMSelect.style.display = use24Hour ? "none" : "inline-block";

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

    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      currentView = "month"; // Switch to month view on click
      updateView();
      renderMiniCalendar(currentDate);
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

    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      openEventModal(cellDate);
    });

    const dayEvents = events
      .filter(e => parseDateOnly(e.date).toDateString() === cellDate.toDateString())
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    dayEvents.forEach(event => {
      const div = document.createElement("div");
      div.classList.add("month-event");
      div.textContent = `${event.title} (${formatTimeForDisplay(event)})`;
      div.addEventListener("click", ev => {
        ev.stopPropagation();
        openDetailsModal(event);
      });
      cell.appendChild(div);
    });

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
  weekView.appendChild(timeCol);

  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  for (let d = 0; d < 7; d++) {
    const col = document.createElement("div");
    col.classList.add("day-column");

    const header = document.createElement("div");
    header.classList.add("day-header");
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + d);
    header.textContent = dayDate.toLocaleDateString("default", { weekday:"short", month:"short", day:"numeric" });
    col.appendChild(header);

    const slots = document.createElement("div");
    slots.classList.add("day-slots");

    for (let h = 0; h < 24; h++) {
      const slot = document.createElement("div");
      slot.classList.add("hour-slot");
      slot.addEventListener("click", () => {
        selectedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h);
        openEventModal(selectedDate);
      });
      slots.appendChild(slot);
    }
    col.appendChild(slots);

    const dayEvents = events
      .filter(e => parseDateOnly(e.date).toDateString() === dayDate.toDateString())
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    dayEvents.forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("event-box");
      evBox.textContent = `${event.title} (${formatTimeForDisplay(event)})`;

      const startMin = getTimeInMinutes(event.time || "00:00");
      evBox.style.top = `${startMin}px`;

      let height;
      if (event.isAllDay) {
        height = 24 * 60;
      } else if (event.endTime) {
        const endMin = getTimeInMinutes(event.endTime);
        height = endMin - startMin;
      } else {
        height = 60; // Default 1 hour
      }
      evBox.style.height = `${height}px`;

      evBox.addEventListener("click", e => {
        e.stopPropagation();
        openDetailsModal(event);
      });

      col.appendChild(evBox);
    });

    weekView.appendChild(col);
  }
}

// ===== Year View =====
function renderYearView() {
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

      const dayEvents = events.filter(e => parseDateOnly(e.date).toDateString() === cellDate.toDateString());
      if (dayEvents.length > 0) cell.classList.add("has-events");

      cell.addEventListener("click", () => {
        selectedDate = cellDate;
        currentDate = new Date(cellDate); // Sync currentDate with selectedDate
        currentView = "month"; // Switch to month view on click
        updateView();
        renderMiniCalendar(currentDate);
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

  if (currentView === "month") {
    monthView.classList.remove("hidden");
    viewToggle.textContent = "Year View"; // Next is year
    renderMonthView();
  } else if (currentView === "week") {
    weekView.classList.remove("hidden");
    viewToggle.textContent = "Month View"; // Next is month
    renderWeekView();
  } else if (currentView === "year") {
    yearView.classList.remove("hidden");
    viewToggle.textContent = "Week View"; // Next is week
    renderYearView();
  }
}

// ===== Modals =====
function openEventModal(date, event = null) {
  eventForm.reset();
  eventDateInput.value = date.toISOString().slice(0,10);
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

// ===== Event Handling =====
eventForm.addEventListener("submit", e => {
  e.preventDefault();

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
      alert("Invalid start time");
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
        alert("Invalid end time");
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
        alert("End time must be after start time");
        return;
      }
    }
  }

  const eventData = {
    title: eventTitleInput.value,
    date: eventDateInput.value,
    time: timeStr,
    endTime: endTimeStr,
    isAllDay: isAllDay,
    details: eventDetailsInput.value,
  };

  if (editingEvent) {
    const index = events.findIndex(ev => ev.id === editingEvent.id);
    if (index !== -1) {
      events[index] = { ...events[index], ...eventData };
    }
  } else {
    events.push({ id: Date.now(), ...eventData });
  }

  saveEvents();
  updateView();
  renderMiniCalendar(currentDate);
  closeModal(eventModal);
});

// ===== Details Modal =====
function openDetailsModal(event) {
  activeEventId = event.id;
  detailsContent.innerHTML = `
    <h3>${event.title}</h3>
    <p><strong>Date:</strong> ${event.date}</p>
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
    renderMiniCalendar(currentDate);
    closeModal(detailsModal);
  }
});

// ===== Edit Event =====
editEventBtn.addEventListener("click", () => {
  const event = events.find(e => e.id === activeEventId);
  if (event) {
    closeModal(detailsModal);
    const date = parseDateOnly(event.date);
    openEventModal(date, event);
  }
});

// ===== View Toggle =====
viewToggle.addEventListener("click", () => {
  if (currentView === "week") {
    currentView = "month";
  } else if (currentView === "month") {
    currentView = "year";
  } else {
    currentView = "week";
  }
  updateView();
});

// ===== Create Event Button =====
createEventBtn.addEventListener("click", () => openEventModal(selectedDate));

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
  localStorage.setItem("calendarEvents", JSON.stringify(events));
}

// ===== Month Navigation =====
document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  renderMiniCalendar(currentDate);
  updateView();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  selectedDate.setMonth(selectedDate.getMonth() + 1);
  renderMiniCalendar(currentDate);
  updateView();
});

// ===== Log In Button =====
logInButton.addEventListener("click", () => {
  loginModal.classList.add("open");
});

// ===== Init =====
renderMiniCalendar(currentDate);
updateView();
updateTimeInputs();