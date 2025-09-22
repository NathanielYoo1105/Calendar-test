document.addEventListener("DOMContentLoaded", () => {
  let events = JSON.parse(localStorage.getItem("events") || "[]");

  const loginModal = document.getElementById("loginModal");
  const eventModal = document.getElementById("eventModal");
  const detailsModal = document.getElementById("detailsModal");

  const viewToggle = document.getElementById("viewToggle");
  const createEventBtn = document.getElementById("createEventBtn");
  const weekView = document.getElementById("weekView");
  const monthView = document.getElementById("monthView");

  const eventForm = document.getElementById("eventForm");
  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventTime = document.getElementById("eventTime");
  const eventDetails = document.getElementById("eventDetails");

  const detailsTitle = document.getElementById("detailsTitle");
  const detailsDate = document.getElementById("detailsDate");
  const detailsTime = document.getElementById("detailsTime");
  const detailsText = document.getElementById("detailsText");

  const monthYear = document.getElementById("monthYear");
  const calendarBody = document.getElementById("calendarBody");
  const bigCalendarBody = document.getElementById("bigCalendarBody");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  let currentDate = new Date();
  let showingWeek = true;

  // ----- Modal helpers -----
  function openModal(modal) { modal.classList.add("show"); }
  function closeModal(modal) { modal.classList.remove("show"); }
  document.querySelectorAll(".close-btn").forEach(btn =>
    btn.addEventListener("click", e => closeModal(e.target.closest(".modal")))
  );
  window.addEventListener("click", e => {
    document.querySelectorAll(".modal").forEach(m => {
      if (e.target === m) closeModal(m);
    });
  });

  // ==================== LOGIN SYSTEM ====================
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password!");
    return;
  }

  // Simple demo login (no backend yet)
  currentUser = username;
  localStorage.setItem("currentUser", username);

  alert(`Welcome, ${username}!`);
  closeModal(loginModal);
  updateAuthUI();
  filterEventsForUser();
});

function logOut() {
  localStorage.removeItem("currentUser");
  currentUser = null;
  updateAuthUI();
  renderWeekEvents();
  renderMonthEvents();
  alert("You have been logged out.");
}

function updateAuthUI() {
  if (currentUser) {
    logInButton.textContent = `Log Out (${currentUser})`;
  } else {
    logInButton.textContent = "Log In";
  }
}

// When the button is clicked
logInButton.addEventListener("click", () => {
  if (currentUser) {
    logOut();
  } else {
    openModal(loginModal);
  }
});

updateAuthUI();

// Filter events to only show the current user's events
function filterEventsForUser() {
  if (!currentUser) return [];
  return events.filter(ev => ev.user === currentUser);
}


  // ----- Mini calendar -----
  function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    monthYear.textContent = date.toLocaleString("default", { month: "long" }) + " " + year;
    calendarBody.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");
    for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("td");
      cell.textContent = d;
      const today = new Date();
      if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear())
        cell.classList.add("today");

      cell.addEventListener("click", () => {
        eventDate.value = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        eventTime.value = "";
        eventName.value = "";
        eventDetails.value = "";
        openModal(eventModal);
      });

      row.appendChild(cell);
      if ((firstDay + d) % 7 === 0) {
        calendarBody.appendChild(row);
        row = document.createElement("tr");
      }
    }
    if (row.children.length) calendarBody.appendChild(row);
  }
  prevMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); renderMonthEvents(); });
  nextMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); renderMonthEvents(); });
  renderCalendar(currentDate);

  // ----- Week view -----
  const timeColumn = document.querySelector(".time-column");
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  days.forEach(day => {
    const dayCol = document.createElement("div");
    dayCol.classList.add("day-column");
    const header = document.createElement("div");
    header.classList.add("day-header");
    header.textContent = day;
    dayCol.appendChild(header);

    const slots = document.createElement("div");
    for (let h = 0; h < 24; h++) {
      const slot = document.createElement("div");
      slot.classList.add("hour-slot");
      const stack = document.createElement("div");
      stack.classList.add("events-stack");
      slot.appendChild(stack);

      slot.addEventListener("click", () => {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + days.indexOf(day));
        eventDate.value = date.toISOString().slice(0, 10);
        eventTime.value = String(h).padStart(2, "0") + ":00";
        openModal(eventModal);
      });

      slots.appendChild(slot);
    }
    dayCol.appendChild(slots);
    weekView.appendChild(dayCol);
  });

  for (let h = 0; h < 24; h++) {
    const div = document.createElement("div");
    div.textContent = h === 0 ? "12 AM" : h < 12 ? h+" AM" : h === 12 ? "12 PM" : (h-12)+" PM";
    timeColumn.appendChild(div);
  }

  // ----- Save & render -----
  function saveEvents() { localStorage.setItem("events", JSON.stringify(events)); }
  function renderWeekEvents() {
    document.querySelectorAll(".events-stack").forEach(s => s.innerHTML = "");
    events.forEach(ev => {
      const d = new Date(ev.date);
      const col = weekView.children[d.getDay() + 1]; // +1 because col0 is time
      if (!col) return;
      const hour = d.getHours();
      const slot = col.querySelectorAll(".events-stack")[hour];

      const el = document.createElement("div");
      el.classList.add("event");
      el.textContent = ev.name;
      const del = document.createElement("span");
      del.textContent = "×";
      del.classList.add("delete-event");
      del.addEventListener("click", e => {
        e.stopPropagation();
        events = events.filter(x => x.id !== ev.id);
        saveEvents();
        renderWeekEvents();
        renderMonthEvents();
      });
      el.appendChild(del);

      el.addEventListener("click", () => {
        detailsTitle.textContent = ev.name;
        detailsDate.textContent = "Date: " + ev.date;
        detailsTime.textContent = "Time: " + (ev.time || "All Day");
        detailsText.textContent = "Details: " + (ev.details || "None");
        openModal(detailsModal);
      });

      slot.appendChild(el);
    });
  }

  function renderMonthEvents() {
    bigCalendarBody.innerHTML = "";
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");
    for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("td");
      cell.textContent = d;
      const wrapper = document.createElement("div");
      wrapper.classList.add("events-wrapper");

      const cellDate = new Date(year, month, d);
      events.filter(ev => new Date(ev.date).toDateString() === cellDate.toDateString())
        .forEach(ev => {
          const el = document.createElement("div");
          el.classList.add("event");
          el.textContent = ev.name;
          const del = document.createElement("span");
          del.textContent = "×";
          del.classList.add("delete-event");
          del.addEventListener("click", e => {
            e.stopPropagation();
            events = events.filter(x => x.id !== ev.id);
            saveEvents();
            renderMonthEvents();
            renderWeekEvents();
          });
          el.appendChild(del);
          el.addEventListener("click", () => {
            detailsTitle.textContent = ev.name;
            detailsDate.textContent = "Date: " + ev.date;
            detailsTime.textContent = "Time: " + (ev.time || "All Day");
            detailsText.textContent = "Details: " + (ev.details || "None");
            openModal(detailsModal);
          });
          wrapper.appendChild(el);
        });

      cell.appendChild(wrapper);
      row.appendChild(cell);

      if ((firstDay + d) % 7 === 0) {
        bigCalendarBody.appendChild(row);
        row = document.createElement("tr");
      }
    }
    if (row.children.length) bigCalendarBody.appendChild(row);
  }

  // ----- Toggle views -----
  viewToggle.addEventListener("click", () => {
    showingWeek = !showingWeek;
    weekView.classList.toggle("hidden", !showingWeek);
    monthView.classList.toggle("hidden", showingWeek);
    viewToggle.textContent = showingWeek ? "Month View" : "Week View";
  });

  // ----- Create Event button -----
  createEventBtn.addEventListener("click", () => {
    eventName.value = "";
    eventDate.value = "";
    eventTime.value = "";
    eventDetails.value = "";
    openModal(eventModal);
  });

  // ----- Save event -----
  eventForm.addEventListener("submit", e => {
    e.preventDefault();
    const newEvent = {
      id: Date.now(),
      name: eventName.value,
      date: eventDate.value,
      time: eventTime.value,
      details: eventDetails.value
    };
    events.push(newEvent);
    saveEvents();
    renderWeekEvents();
    renderMonthEvents();
    closeModal(eventModal);
  });

  // Initial render
  renderWeekEvents();
  renderMonthEvents();
});
