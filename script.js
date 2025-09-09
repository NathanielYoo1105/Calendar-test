document.addEventListener("DOMContentLoaded", () => {
  // ===== LOGIN MODAL =====
  const logInButton = document.getElementById("logInButton");
  const loginModal = document.getElementById("loginModal");
  const loginClose = loginModal.querySelector(".close-btn");

  logInButton.addEventListener("click", () => {
    loginModal.classList.add("open");
  });

  loginClose.addEventListener("click", () => {
    loginModal.classList.remove("open");
  });

  window.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.remove("open");
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      loginModal.classList.remove("open");
    }
  });

  // ===== MINI CALENDAR =====
  const monthYear = document.getElementById("monthYear");
  const calendarBody = document.getElementById("calendarBody");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  let currentDate = new Date();

  function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    monthYear.textContent =
      date.toLocaleString("default", { month: "long" }) + " " + year;

    calendarBody.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");

    for (let i = 0; i < firstDay; i++) {
      row.appendChild(document.createElement("td"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement("td");
      cell.textContent = day;

      const today = new Date();
      if (
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      ) {
        cell.classList.add("today");
      }

      row.appendChild(cell);

      if ((firstDay + day) % 7 === 0) {
        calendarBody.appendChild(row);
        row = document.createElement("tr");
      }
    }

    if (row.children.length > 0) {
      calendarBody.appendChild(row);
    }
  }

  prevMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  });

  nextMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  });

  calendarBody.addEventListener("click", (e) => {
    if (e.target.tagName === "TD" && e.target.textContent) {
      calendarBody.querySelectorAll("td").forEach((td) =>
        td.classList.remove("selected")
      );
      e.target.classList.add("selected");
    }
  });

  renderCalendar(currentDate);

  // ===== WEEK VIEW 24-HOURS =====
  const timeColumn = document.querySelector(".time-column");
  const eventGrid = document.querySelector(".event-grid");

  // time labels
  for (let hour = 0; hour < 24; hour++) {
    const div = document.createElement("div");
    const label =
      hour === 0
        ? "12 AM"
        : hour < 12
        ? hour + " AM"
        : hour === 12
        ? "12 PM"
        : hour - 12 + " PM";
    div.textContent = label;
    timeColumn.appendChild(div);
  }

  // days of week
  const days = [
    "Sunday","Monday","Tuesday",
    "Wednesday","Thursday","Friday","Saturday"
  ];

  days.forEach((dayName) => {
    const dayCol = document.createElement("div");
    dayCol.classList.add("day-column");

    const header = document.createElement("div");
    header.classList.add("day-header");
    header.textContent = dayName;

    const slots = document.createElement("div");
    slots.classList.add("day-slots");

    for (let i = 0; i < 24; i++) {
      const slot = document.createElement("div");
      slot.classList.add("hour-slot");
      slots.appendChild(slot);
    }

    dayCol.appendChild(header);
    dayCol.appendChild(slots);
    eventGrid.appendChild(dayCol);
  });
});
