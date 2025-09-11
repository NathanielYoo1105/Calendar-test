document.addEventListener("DOMContentLoaded", () => {
  // ===== STATE =====
  let events = JSON.parse(localStorage.getItem("events") || "[]");
  let currentDate = new Date();

  // ===== MODALS =====
  const logInButton = document.getElementById("logInButton");
  const loginModal = document.getElementById("loginModal");
  const loginClose = loginModal.querySelector(".close-btn");
  logInButton.addEventListener("click", () => loginModal.classList.add("show"));
  loginClose.addEventListener("click", () => loginModal.classList.remove("show"));
  window.addEventListener("click", e => { if(e.target===loginModal) loginModal.classList.remove("show"); });
  window.addEventListener("keydown", e => { if(e.key==="Escape") loginModal.classList.remove("show"); });

  // ===== ELEMENTS =====
  const monthYear = document.getElementById("monthYear");
  const calendarBody = document.getElementById("calendarBody");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const weekView = document.getElementById("weekView");
  const monthView = document.getElementById("monthView");
  const viewToggle = document.getElementById("viewToggle");
  const bigCalendarBody = document.getElementById("bigCalendarBody");
  const timeColumn = document.querySelector(".time-column");
  const eventGrid = document.querySelector(".event-grid");

  let showingWeek = true;

  // ===== MINI CALENDAR =====
  function renderMiniCalendar(date){
    const year = date.getFullYear();
    const month = date.getMonth();
    monthYear.textContent = `${date.toLocaleString("default",{month:"long"})} ${year}`;
    const firstDay = new Date(year, month,1).getDay();
    const daysInMonth = new Date(year, month+1,0).getDate();

    calendarBody.innerHTML="";
    let row=document.createElement("tr");
    for(let i=0;i<firstDay;i++) row.appendChild(document.createElement("td"));
    for(let day=1;day<=daysInMonth;day++){
      if((row.children.length)%7===0 && row.children.length!==0){
        calendarBody.appendChild(row);
        row=document.createElement("tr");
      }
      const cell=document.createElement("td");
      cell.textContent=day;
      const today = new Date();
      if(day===today.getDate() && month===today.getMonth() && year===today.getFullYear()){
        cell.classList.add("today");
      }
      row.appendChild(cell);
    }
    calendarBody.appendChild(row);
  }

  prevMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()-1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate); });
  nextMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()+1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate); });

  renderMiniCalendar(currentDate);

  // ===== BIG CALENDAR =====
  function renderBigCalendar(date){
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1,0).getDate();

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
        evEl.textContent = `${ev.time} ${ev.name}`;
        cell.appendChild(evEl);
      });
      const today = new Date();
      if(day===today.getDate() && month===today.getMonth() && year===today.getFullYear()){
        cell.classList.add("today");
      }
      row.appendChild(cell);
    }
    bigCalendarBody.appendChild(row);
  }

  renderBigCalendar(currentDate);

  // ===== WEEK VIEW =====
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
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const today = new Date();

    const dayColumns = eventGrid.querySelectorAll(".day-column");
    dayColumns.forEach((col, idx)=>{
      const slots = col.querySelector(".day-slots");
      slots.querySelectorAll(".event").forEach(e=>e.remove());

      const dateObj = new Date(startOfWeek);
      dateObj.setDate(startOfWeek.getDate() + idx);
      const dateStr = dateObj.toISOString().split("T")[0];

      if(dateObj.toDateString() === today.toDateString()){
        col.classList.add("today");
      } else {
        col.classList.remove("today");
      }

      events.filter(ev=>ev.date===dateStr).forEach(ev=>{
        const hour = parseInt(ev.time.split(":")[0],10);
        const slot = slots.children[hour];
        const evEl = document.createElement("div");
        evEl.className="event";
        evEl.textContent = ev.name;
        slot.appendChild(evEl);
      });
    });
  }

  renderWeekEvents();

  // ===== TOGGLE VIEW =====
  viewToggle.addEventListener("click", () => {
    showingWeek = !showingWeek;
    if(showingWeek){
      weekView.classList.remove("hidden");
      monthView.classList.add("hidden");
      viewToggle.textContent="Week View";
    } else {
      weekView.classList.add("hidden");
      monthView.classList.remove("hidden");
      renderBigCalendar(currentDate);
      viewToggle.textContent="Month View";
    }
  });

  // ===== EVENT MODAL =====
  const eventModal = document.getElementById("eventModal");
  const eventForm = document.getElementById("eventForm");
  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventTime = document.getElementById("eventTime");
  const eventDetails = document.getElementById("eventDetails");

  // Month view click
  bigCalendarBody.addEventListener("click", e => {
    const cell = e.target.closest("td");
    if(!cell) return;
    const dayDiv = cell.querySelector(".date-num");
    if(!dayDiv) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = parseInt(dayDiv.textContent);
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

    eventForm.reset();
    eventDate.value = dateStr;
    eventTime.value = "";
    eventModal.classList.add("show");
  });

  // Week view click
  eventGrid.querySelectorAll(".hour-slot").forEach(slot => {
    slot.addEventListener("click", e => {
      const dayCol = e.target.closest(".day-column");
      const dayIndex = Array.from(eventGrid.querySelectorAll(".day-column")).indexOf(dayCol);
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const dateObj = new Date(startOfWeek);
      dateObj.setDate(startOfWeek.getDate() + dayIndex);
      const dateStr = dateObj.toISOString().split("T")[0];

      const hour = Array.from(dayCol.querySelectorAll(".hour-slot")).indexOf(e.target.closest(".hour-slot"));
      const timeStr = `${String(hour).padStart(2,"0")}:00`;

      eventForm.reset();
      eventDate.value = dateStr;
      eventTime.value = timeStr;
      eventModal.classList.add("show");
    });
  });

  // Close modal
  eventModal.querySelector(".close-btn").addEventListener("click", () => eventModal.classList.remove("show"));
  window.addEventListener("click", e => { if(e.target===eventModal) eventModal.classList.remove("show"); });
  window.addEventListener("keydown", e => { if(e.key==="Escape") eventModal.classList.remove("show"); });

  // Submit event
  eventForm.addEventListener("submit", e => {
    e.preventDefault();
    events.push({
      name: eventName.value,
      date: eventDate.value,
      time: eventTime.value,
      details: eventDetails.value
    });
    localStorage.setItem("events", JSON.stringify(events));
    eventModal.classList.remove("show");
    renderBigCalendar(currentDate);
    renderWeekEvents();
  });
});
