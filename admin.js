const ADMIN_EMAIL = "textilien@proton.me";
const auth = firebase.auth();
const db = firebase.firestore();
const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logoutBtn");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const ordersList = document.getElementById("ordersList");
const ordersMessage = document.getElementById("ordersMessage");
const refreshBtn = document.getElementById("refreshBtn");
const statOrders = document.getElementById("statOrders");
const statShirts = document.getElementById("statShirts");
const statRevenue = document.getElementById("statRevenue");
const lastUpdate = document.getElementById("lastUpdate");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
let loadedOrders = [];

const STATUSES = ["Neu", "In Bearbeitung", "Fertig", "Abgeholt"];

function euro(value){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(value)||0)}
function dateText(ts){if(!ts||!ts.toDate)return "Datum wird geladen";return ts.toDate().toLocaleString("de-DE",{dateStyle:"medium",timeStyle:"short"})}
function text(value,fallback="–"){return value===undefined||value===null||value===""?fallback:String(value)}

async function loadOrders(){
  ordersList.replaceChildren();
  ordersMessage.hidden = true;
  lastUpdate.textContent = "Bestellungen werden geladen …";
  try{
    const snap = await db.collection("orders").orderBy("createdAt","desc").get();
    loadedOrders = snap.docs.map(doc => ({ id: doc.id, order: doc.data() }));
    updateStats(loadedOrders);
    applyFilters();
    lastUpdate.textContent = `Aktualisiert: ${new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}`;
  }catch(err){
    console.error(err);
    ordersMessage.textContent = "Bestellungen konnten nicht geladen werden.";
    ordersMessage.hidden = false;
    lastUpdate.textContent = "Fehler beim Laden";
  }
}

function updateStats(entries){
  let shirts=0,revenue=0;
  entries.forEach(({order})=>{
    shirts += Number(order.totalQuantity)||0;
    revenue += Number(order.totalPrice)||0;
  });
  statOrders.textContent = entries.length;
  statShirts.textContent = shirts;
  statRevenue.textContent = euro(revenue);
}

function searchableText(entry){
  const o = entry.order || {};
  return [
    o.orderNumber, entry.id, o.name, o.customerClass, o.email, o.phone, o.status,
    ...(Array.isArray(o.items) ? o.items.flatMap(item => [item.size,item.shirtColor,item.motif,item.motifColor]) : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function applyFilters(){
  const query = (searchInput.value || "").trim().toLowerCase();
  const selectedStatus = statusFilter.value || "Alle";
  const filtered = loadedOrders.filter(entry => {
    const status = entry.order.status || "Neu";
    const statusMatch = selectedStatus === "Alle" || status === selectedStatus;
    const searchMatch = !query || searchableText(entry).includes(query);
    return statusMatch && searchMatch;
  });

  ordersList.replaceChildren();
  filtered.forEach(entry => ordersList.appendChild(renderOrder(entry.id, entry.order)));
  ordersMessage.textContent = loadedOrders.length === 0 ? "Keine Bestellungen vorhanden." : "Keine passenden Bestellungen gefunden.";
  ordersMessage.hidden = filtered.length !== 0;
}

function renderOrder(id,order){
  const card=document.createElement("article");card.className="order-card";
  const top=document.createElement("div");top.className="order-top";
  const title=document.createElement("div");
  const number=document.createElement("div");number.className="order-number";number.textContent=text(order.orderNumber,id);
  const date=document.createElement("div");date.className="order-date";date.textContent=dateText(order.createdAt);
  title.append(number,date);
  const status=document.createElement("select");status.className="status-select";status.setAttribute("aria-label",`Status ${id}`);
  STATUSES.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=value;option.selected=(order.status||"Neu")===value;status.appendChild(option)});
  status.addEventListener("change",async()=>{
    const previousStatus = order.status || "Neu";
    status.disabled=true;
    try{
      await db.collection("orders").doc(id).update({status:status.value,statusUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      order.status = status.value;
      if(statusFilter.value !== "Alle") applyFilters();
    }catch(err){
      status.value = previousStatus;
      alert("Status konnte nicht gespeichert werden.");
      console.error(err);
    }finally{status.disabled=false}
  });
  top.append(title,status);card.appendChild(top);

  const customer=document.createElement("div");customer.className="customer-grid";
  [["Name",order.name],["Klasse / Abteilung",order.customerClass],["E-Mail",order.email],["Telefon",order.phone]].forEach(([label,value])=>{const box=document.createElement("div");const l=document.createElement("span");l.textContent=label;const v=document.createElement("strong");v.textContent=text(value);box.append(l,v);customer.appendChild(box)});
  card.appendChild(customer);

  const items=document.createElement("div");items.className="items";
  (Array.isArray(order.items)?order.items:[]).forEach((item,index)=>{const row=document.createElement("div");row.className="item-row";const a=document.createElement("strong");a.textContent=`${index+1}. ${text(item.quantity,"1")}× ${text(item.size)} · ${text(item.shirtColor)} · ${euro(item.linePrice ?? ((Number(item.quantity)||1)*(Number(order.unitPrice)||15)))}`;const b=document.createElement("span");b.textContent=`${text(item.motif)} · Motivfarbe: ${text(item.motifColor)}`;row.append(a,b);items.appendChild(row)});
  card.appendChild(items);
  const footer=document.createElement("div");footer.className="order-footer";footer.innerHTML=`<span>${text(order.totalQuantity,"0")} Shirts</span><span>${euro(order.totalPrice)}</span>`;card.appendChild(footer);
  return card;
}

loginForm.addEventListener("submit",async e=>{
  e.preventDefault();loginMessage.textContent="";
  const email=document.getElementById("adminEmail").value.trim();const password=document.getElementById("adminPassword").value;
  if(email.toLowerCase()!==ADMIN_EMAIL){loginMessage.textContent="Dieses Konto ist nicht als Admin freigegeben.";return}
  try{await auth.signInWithEmailAndPassword(email,password)}catch(err){console.error(err);loginMessage.textContent="Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen."}
});
logoutBtn.addEventListener("click",()=>auth.signOut());
refreshBtn.addEventListener("click",loadOrders);
searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);

auth.onAuthStateChanged(user=>{
  const admin = user && (user.email||"").toLowerCase()===ADMIN_EMAIL;
  loginCard.hidden=!!admin;dashboard.hidden=!admin;logoutBtn.hidden=!admin;
  if(admin) loadOrders();
  else if(user) auth.signOut();
});
