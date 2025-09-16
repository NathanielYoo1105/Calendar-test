// script.js (updated with year view, AM/PM ↔ 24-hour toggle, and dynamic hour labels)

// ===== Global State =====
let events = JSON.parse(localStorage.getItem("calendarEvents")) || [];
let currentDate = new Date();
let selectedDate = new Date();
let use24Hour = false; // false = AM/PM, true = 24-hour
let currentView = "month"; // Track current view: "month", "week", or "year"

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

function formatTimeForDisplay(time24) {
  if (use24Hour) return time24;
  let [hour, minute] = time24.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function updateTimeInputs() {
  eventAMPMSelect.style.display = use24Hour ? "none" : "inline-block";
  if (use24Hour) {
    eventHourInput.min = 0;
    eventHourInput.max = 23;
    eventHourInput.placeholder = "HH (0-23)";
  } else {
    eventHourInput.min = 1;
    eventHourInput.max = 12;
    eventHourInput.placeholder = "HH (1-12)";
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
      .sort((a,b) => a.time.localeCompare(b.time));

    dayEvents.forEach(event => {
      const div = document.createElement("div");
      div.classList.add("month-event");
      div.textContent = `${event.title} (${formatTimeForDisplay(event.time)})`;
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
      .sort((a,b) => a.time.localeCompare(b.time));

    dayEvents.forEach(event => {
      const evBox = document.createElement("div");
      evBox.classList.add("event-box");
      evBox.textContent = `${event.title} (${formatTimeForDisplay(event.time)})`;

      const startTime = parseInt(event.time.split(":")[0], 10);
      evBox.style.top = `${startTime * 60}px`;
      evBox.style.height = "58px";

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
    viewToggle.textContent = "Week View";
    renderMonthView();
  } else if (currentView === "week") {
    weekView.classList.remove("hidden");
    viewToggle.textContent = "Year View";
    renderWeekView();
  } else if (currentView === "year") {
    yearView.classList.remove("hidden");
    viewToggle.textContent = "Month View";
    renderYearView();
  }
}

// ===== Modals =====
function openEventModal(date, event = null) {
  eventForm.reset();
  eventDateInput.value = date.toISOString().slice(0,10);
  if (event) {
    editingEvent = event;
    eventTitleInput.value = event.title;
    eventDateInput.value = event.date;
    let [hour, minute] = event.time.split(":").map(Number);
    eventMinuteInput.value = minute;
    if (!use24Hour) {
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      eventAMPMSelect.value = ampm;
    }
    eventHourInput.value = hour;
    eventDetailsInput.value = event.details || "";
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

  let hour = parseInt(eventHourInput.value, 10);
  const minute = parseInt(eventMinuteInput.value, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    alert("Invalid time");
    return;
  }
  if (!use24Hour) {
    const ampm = eventAMPMSelect.value;
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }
  const timeStr = `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;

  if (editingEvent) {
    const index = events.findIndex(ev => ev.id === editingEvent.id);
    if (index !== -1) {
      events[index] = {
        ...events[index],
        title: eventTitleInput.value,
        date: eventDateInput.value,
        time: timeStr,
        details: eventDetailsInput.value,
      };
    }
  } else {
    const newEvent = {
      id: Date.now(),
      title: eventTitleInput.value,
      date: eventDateInput.value,
      time: timeStr,
      details: eventDetailsInput.value,
    };
    events.push(newEvent);
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
    <p><strong>Time:</strong> ${formatTimeForDisplay(event.time)}</p>
    <p>${event.details || ""}</p>
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
  if (currentView === "month") {
    currentView = "week";
  } else if (currentView === "week") {
    currentView = "year";
  } else {
    currentView = "month";
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