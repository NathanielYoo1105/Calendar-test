// Calendar
const calendarBody = document.getElementById("calendarBody");
const monthYear = document.getElementById("monthYear");
const headerRow = document.getElementById("calendarHeaderRow");

let currentDate = new Date();
let currentView = "week"; // default view

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  monthYear.textContent =
    date.toLocaleString("default", { month: "long" }) + " " + year;

  calendarBody.innerHTML = "";
  headerRow.innerHTML = "";

  if (currentView === "week") {
    // === Week View ===
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    weekDays.forEach((day) => {
      const th = document.createElement("th");
      th.textContent = day;
      headerRow.appendChild(th);
    });

    let row = document.createElement("tr");
    for (let i = 0; i < firstDay.getDay(); i++) {
      row.appendChild(document.createElement("td"));
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      if (row.children.length % 7 === 0 && row.children.length !== 0) {
        calendarBody.appendChild(row);
        row = document.createElement("tr");
      }
      const cell = document.createElement("td");
      cell.textContent = day;
      row.appendChild(cell);
    }
    if (row.children.length > 0) {
      calendarBody.appendChild(row);
    }
  } else if (currentView === "day") {
    // === Day View ===
    const th = document.createElement("th");
    th.textContent = date.toLocaleString("default", { weekday: "long" });
    headerRow.appendChild(th);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      if (day === date.getDate()) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "Day " + day;
        row.appendChild(cell);
        calendarBody.appendChild(row);
      }
    }
  }
}

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar(currentDate);
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar(currentDate);
});

// Switch view buttons
document.getElementById("weekViewBtn").addEventListener("click", () => {
  currentView = "week";
  renderCalendar(currentDate);
});

document.getElementById("dayViewBtn").addEventListener("click", () => {
  currentView = "day";
  renderCalendar(currentDate);
});

renderCalendar(currentDate);

// Modal
const modal = document.getElementById("loginModal");
const openBtn = document.getElementById("myButton");
const closeBtn = document.getElementById("closeModal");

openBtn.onclick = () => (modal.style.display = "block");
closeBtn.onclick = () => (modal.style.display = "none");
window.onclick = (event) => {
  if (event.target === modal) modal.style.display = "none";
};
