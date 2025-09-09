// Calendar
const calendarBody = document.getElementById("calendarBody");
const monthYear = document.getElementById("monthYear");

let currentDate = new Date();

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  monthYear.textContent =
    date.toLocaleString("default", { month: "long" }) + " " + year;

  calendarBody.innerHTML = "";

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
}

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar(currentDate);
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
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
