document.addEventListener("DOMContentLoaded", () => {
  let events = JSON.parse(localStorage.getItem("events") || "[]");
  let currentDate = new Date();

  // ===== MODALS =====
  const logInButton = document.getElementById("logInButton");
  const loginModal = document.getElementById("loginModal");
  const loginClose = loginModal.querySelector(".close-btn");
  logInButton.addEventListener("click", () => loginModal.classList.add("show"));
  loginClose.addEventListener("click", () => loginModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === loginModal) loginModal.classList.remove("show"); });
  window.addEventListener("keydown", e => { if (e.key === "Escape") loginModal.classList.remove("show"); });

  const eventModal = document.getElementById("eventModal");
  const eventForm = document.getElementById("eventForm");
  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventTime = document.getElementById("eventTime");
  const eventDetails = document.getElementById("eventDetails");

  eventModal.querySelector(".close-btn").addEventListener("click", () => eventModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === eventModal) eventModal.classList.remove("show"); });
  window.addEventListener("keydown", e => { if (e.key === "Escape") eventModal.classList.remove("show"); });

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

  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  // ===== MINI CALENDAR =====
  function renderMiniCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    monthYear.textContent = `${date.toLocaleString("default",{month:"long"})} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1,0).getDate();
    calendarBody.innerHTML = "";
    let row = document.createElement("tr");

    for(let i=0;i<firstDay;i++) row.appendChild(document.createElement("td"));

    for(let day=1;day<=daysInMonth;day++){
      const cell=document.createElement("td");
      cell.textContent=day;
      const today=new Date();
      if(day===today.getDate() && month===today.getMonth() && year===today.getFullYear()) cell.classList.add("today");
      cell.addEventListener("click", () => openEventModal(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`));
      row.appendChild(cell);
      if(row.children.length % 7 === 0){ calendarBody.appendChild(row); row=document.createElement("tr"); }
    }
    if(row.children.length > 0) calendarBody.appendChild(row);
  }
  prevMonthBtn.addEventListener("click", ()=>{currentDate.setMonth(currentDate.getMonth()-1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate);});
  nextMonthBtn.addEventListener("click", ()=>{currentDate.setMonth(currentDate.getMonth()+1); renderMiniCalendar(currentDate); renderBigCalendar(currentDate);});
  renderMiniCalendar(currentDate);

  // ===== BIG CALENDAR =====
  function renderBigCalendar(date){
    const year=date.getFullYear();
    const month=date.getMonth();
    const firstDay=new Date(year,month,1).getDay();
    const daysInMonth=new Date(year,month+1,0).getDate();
    bigCalendarBody.innerHTML="";
    let row=document.createElement("tr");

    for(let i=0;i<firstDay;i++) row.appendChild(document.createElement("td"));

    for(let day=1;day<=daysInMonth;day++){
      const cell=document.createElement("td");
      const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      cell.innerHTML=`<div class="date-num">${day}</div><div class="events-wrapper"></div>`;
      const wrapper=cell.querySelector(".events-wrapper");
      events.filter(ev=>ev.date===dateStr).forEach(ev=>{
        const evEl=document.createElement("div");
        evEl.className="event";
        evEl.textContent=`${ev.time?ev.time+" ":""}${ev.name}`;
        // Delete button
        const delBtn=document.createElement("span");
        delBtn.textContent="×";
        delBtn.className="delete-event";
        delBtn.addEventListener("click", (e)=>{
          e.stopPropagation();
          events = events.filter(event => event !== ev);
          localStorage.setItem("events", JSON.stringify(events));
          renderWeekEvents();
          renderBigCalendar(currentDate);
        });
        evEl.appendChild(delBtn);
        wrapper.appendChild(evEl);
      });
      const today=new Date();
      if(day===today.getDate() && month===today.getMonth() && year===today.getFullYear()) cell.classList.add("today");
      row.appendChild(cell);
      if(row.children.length % 7 === 0){ bigCalendarBody.appendChild(row); row=document.createElement("tr"); }
    }
    if(row.children.length > 0) bigCalendarBody.appendChild(row);
  }
  renderBigCalendar(currentDate);

  // ===== WEEK VIEW =====
  // time labels
  for(let hour=0;hour<24;hour++){
    const div=document.createElement("div");
    const label=hour===0?"12 AM":hour<12?hour+" AM":hour===12?"12 PM":hour-12+" PM";
    div.textContent=label;
    timeColumn.appendChild(div);
  }

  days.forEach(day=>{
    const dayCol=document.createElement("div");
    dayCol.classList.add("day-column");
    const header=document.createElement("div"); header.classList.add("day-header"); header.textContent=day;
    const slots=document.createElement("div"); slots.classList.add("day-slots");
    for(let i=0;i<24;i++){
      const slot=document.createElement("div"); slot.classList.add("hour-slot");
      const stack=document.createElement("div"); stack.classList.add("events-stack");
      slot.appendChild(stack);
      slot.addEventListener("click", ()=>{
        const today=new Date();
        const dayOffset=days.indexOf(day)-today.getDay();
        const eventDay=new Date(today); eventDay.setDate(today.getDate()+dayOffset);
        const dateStr=`${eventDay.getFullYear()}-${String(eventDay.getMonth()+1).padStart(2,"0")}-${String(eventDay.getDate()).padStart(2,"0")}`;
        const timeStr=`${String(i).padStart(2,"0")}:00`;
        openEventModal(dateStr,timeStr);
      });
      slots.appendChild(slot);
    }
    dayCol.appendChild(header); dayCol.appendChild(slots); eventGrid.appendChild(dayCol);
  });

  function renderWeekEvents(){
    const today=new Date();
    const startDate=new Date(today); startDate.setDate(today.getDate()-today.getDay());
    document.querySelectorAll(".day-column").forEach((col,i)=>{
      const stackCols=col.querySelectorAll(".hour-slot .events-stack");
      stackCols.forEach(stack=>stack.innerHTML="");
      const colDate=new Date(startDate); colDate.setDate(startDate.getDate()+i);
      const dateStr=`${colDate.getFullYear()}-${String(colDate.getMonth()+1).padStart(2,"0")}-${String(colDate.getDate()).padStart(2,"0")}`;
      const dayEvents=events.filter(ev=>ev.date===dateStr);
      dayEvents.forEach(ev=>{
        let hour=parseInt(ev.time?.split(":")[0]||0);
        const evEl=document.createElement("div"); evEl.className="event"; evEl.textContent=ev.name;

        // Delete button
        const delBtn=document.createElement("span");
        delBtn.textContent="×";
        delBtn.className="delete-event";
        delBtn.addEventListener("click",(e)=>{
          e.stopPropagation();
          events = events.filter(event => event !== ev);
          localStorage.setItem("events",JSON.stringify(events));
          renderWeekEvents();
          renderBigCalendar(currentDate);
        });
        evEl.appendChild(delBtn);

        if(stackCols[hour]) stackCols[hour].appendChild(evEl);
      });
    });
  }
  renderWeekEvents();

  // ===== EVENT MODAL =====
  function openEventModal(dateStr="", timeStr=""){
    eventModal.classList.add("show");
    eventDate.value=dateStr; eventTime.value=timeStr;
  }

  eventForm.addEventListener("submit", e=>{
    e.preventDefault();
    const newEvent={name:eventName.value,date:eventDate.value,time:eventTime.value,details:eventDetails.value};
    events.push(newEvent); localStorage.setItem("events",JSON.stringify(events));
    eventModal.classList.remove("show"); eventForm.reset();
    renderBigCalendar(currentDate); renderWeekEvents();
  });

  // ===== TOGGLE WEEK / MONTH VIEW =====
  viewToggle.addEventListener("click", ()=>{
    showingWeek=!showingWeek;
    if(showingWeek){ weekView.classList.remove("hidden"); monthView.classList.add("hidden"); viewToggle.textContent="Week View"; }
    else{ weekView.classList.add("hidden"); monthView.classList.remove("hidden"); renderBigCalendar(currentDate); viewToggle.textContent="Month View"; }
  });
});
