document.addEventListener("DOMContentLoaded", () => {
  // ===== STATE =====
  let events = JSON.parse(localStorage.getItem("events") || "[]");

  let currentDate = new Date();

  // ===== LOGIN MODAL =====
  const logInButton = document.getElementById("logInButton");
  const loginModal = document.getElementById("loginModal");
  const loginClose = loginModal.querySelector(".close-btn");

  logInButton.addEventListener("click", () => loginModal.classList.add("show"));
  loginClose.addEventListener("click", () => loginModal.classList.remove("show"));
  window.addEventListener("click", e => { if(e.target === loginModal) loginModal.classList.remove("show"); });
  window.addEventListener("keydown", e => { if(e.key==="Escape") loginModal.classList.remove("show"); });

  // ===== EVENT MODAL =====
  const eventModal = document.getElementById("eventModal");
  const addEventBtn = document.getElementById("addEventBtn");
  const eventForm = document.getElementById("eventForm");
  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventTime = document.getElementById("eventTime");
  const eventDetails = document.getElementById("eventDetails");

  addEventBtn.addEventListener("click", () => {
    eventForm.reset();
    eventModal.classList.add("show");
  });

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newEvent = {
      name: eventName.value,
      date: eventDate.value,
      time: eventTime.value,
      details: eventDetails.value
    };
    events.push(newEvent);
    localStorage.setItem("events", JSON.stringify(events));
    eventModal.classList.remove("show");
    renderBigCalendar(currentDate);
    renderWeekEvents();
  });

  document.querySelectorAll(".modal .close-btn").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".modal").classList.remove("show"));
  });

  // ===== MINI CALENDAR =====
  const monthYear = document.getElementById("monthYear");
  const calendarBody = document.getElementById("calendarBody");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  function renderMiniCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    monthYear.textContent = `${date.toLocaleString("default", { month: "long" })} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    calendarBody.innerHTML = "";
    let row = document.createElement("tr");

    for(let i=0;i<firstDay;i++) row.appendChild(document.createElement("td"));
    for(let day=1;day<=daysInMonth;day++){
      if((row.children.length)%7===0 && row.children.length!==0){
        calendarBody.appendChild(row);
        row = document.createElement("tr");
      }
      const cell = document.createElement("td");
      cell.textContent = day;
      row.appendChild(cell);
    }
    calendarBody.appendChild(row);
  }

  prevMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()-1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate); });
  nextMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()+1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate); });

  renderMiniCalendar(currentDate);

  // ===== BIG CALENDAR =====
  const bigCalendarBody = document.getElementById("bigCalendarBody");

  function renderBigCalendar(date){
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    bigCalendarBody.innerHTML="";
    let row=document.createElement("tr");

    for(let i=0;i<firstDay;i++) row.appendChild(document.createElement("td"));
    for(let day=1;day<=daysInMonth;day++){
      if((row.children.length)%7===0 && row.children.length!==0){
        bigCalendarBody.appendChild(row);
        row=document.createElement("tr");
      }
      const cell=document.createElement("td");
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      cell.innerHTML=`<div class="date-num">${day}</div>`;
      events.filter(ev=>ev.date===dateStr).forEach(ev=>{
        const evEl=document.createElement("div");
        evEl.className="event";
        evEl.textContent=`${ev.time} ${ev.name}`;
        cell.appendChild(evEl);
      });
      row.appendChild(cell);
    }
    bigCalendarBody.appendChild(row);
  }

  renderBigCalendar(currentDate);

  // ===== WEEK VIEW =====
  const timeColumn = document.querySelector(".time-column");
  const eventGrid = document.querySelector(".event-grid");
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  // time labels
  for(let hour=0;hour<24;hour++){
    const div=document.createElement("div");
    const label = hour===0?"12 AM":hour<12?`${hour} AM`:hour===12?"12 PM":`${hour-12} PM`;
    div.textContent=label;
    timeColumn.appendChild(div);
  }

  // day columns
  days.forEach(day=>{
    const dayCol=document.createElement("div");
    dayCol.classList.add("day-column");
    const header=document.createElement("div");
    header.classList.add("day-header");
    header.textContent=day;
    const slots=document.createElement("div");
    slots.classList.add("day-slots");
    for(let i=0;i<24;i++){
      const slot=document.createElement("div");
      slot.classList.add("hour-slot");
      slots.appendChild(slot);
    }
    dayCol.appendChild(header);
    dayCol.appendChild(slots);
    eventGrid.appendChild(dayCol);
  });

  function renderWeekEvents(){
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate()-currentDate.getDay());
    const weekStartStr = startOfWeek.toISOString().split("T")[0];

    const dayColumns = eventGrid.querySelectorAll(".day-column");
    dayColumns.forEach((col, idx)=>{
      const slots = col.querySelector(".day-slots");
      slots.querySelectorAll(".event").forEach(e=>e.remove());

      const dateObj = new Date(startOfWeek);
      dateObj.setDate(startOfWeek.getDate()+idx);
      const dateStr = dateObj.toISOString().split("T")[0];
      events.filter(ev=>ev.date===dateStr).forEach(ev=>{
        const evEl=document.createElement("div");
        evEl.className="event";
        evEl.textContent=ev.name;
        const hour = parseInt(ev.time.split(":")[0]);
        evEl.style.position="absolute";
        evEl.style.top=`${hour*40}px`;
        evEl.style.left="2px";
        evEl.style.right="2px";
        slots.appendChild(evEl);
      });
    });
  }

  renderWeekEvents();

  // ===== TOGGLE VIEW =====
  const viewToggle = document.getElementById("viewToggle");
  const weekView = document.getElementById("weekView");
  const monthView = document.getElementById("monthView");
  let showingWeek = true;

  viewToggle.addEventListener("click",()=>{
    showingWeek = !showingWeek;
    if(showingWeek){
      weekView.classList.remove("hidden");
      monthView.classList.add("hidden");
      viewToggle.textContent="Week View";
    }else{
      weekView.classList.add("hidden");
      monthView.classList.remove("hidden");
      viewToggle.textContent="Month View";
    }
  });
});
