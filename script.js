// Shop-/Vereinsbranding aus shop-config.js anwenden.
(function applyShopConfig() {
  const cfg = window.SHOP_CONFIG || {};
  if (cfg.pageTitle) document.title = cfg.pageTitle;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  };
  setText("brandTitle", cfg.brandTitle);
  setText("brandSubtitle", cfg.brandSubtitle);
  setText("designerHeading", cfg.designerHeading);
  setText("designerIntro", cfg.designerIntro);
  if (cfg.accentColor) document.documentElement.style.setProperty("--accent", cfg.accentColor);
  if (cfg.logoFile) {
    const brand = document.querySelector(".brand");
    if (brand) {
      const img = document.createElement("img");
      img.src = cfg.logoFile;
      img.alt = cfg.brandTitle || "Shop Logo";
      img.className = "shop-brand-logo";
      img.style.height = `${Number(cfg.logoHeight) || 52}px`;
      img.onerror = () => img.remove();
      brand.prepend(img);
    }
  }
})();

const canvas = new fabric.Canvas("designCanvas", {
  width: 260,
  height: 330,
  backgroundColor: "transparent",
  selection: true,
  preserveObjectStacking: true
});

const resetBtn = document.getElementById("resetBtn");
const viewButtons = document.querySelectorAll(".view-btn");
const shirtColorButtons = document.querySelectorAll(".shirt-color");
const motifButtons = document.querySelectorAll(".motif-btn");
const motifColorButtons = document.querySelectorAll(".motif-color");
const shirtMockup = document.getElementById("shirtMockup");
const currentColorName = document.getElementById("currentColorName");
const currentMotifColorName = document.getElementById("currentMotifColorName");
const designerStatus = document.getElementById("designerStatus");
const printZone = document.getElementById("printZone");

let currentView = "front";
let currentShirtColor = "#ffffff";
let currentShirtColorId = "weiss";
let currentPattern = "";
let currentMotifColor = "#000000";
let currentMotifColorLabel = "Black";

const viewStates = { front: null, back: null };
const baseImages = { front: null, back: null };
const motifSourceCache = new Map();

function enhanceMotifColorCards() {
  // Pantone-/Zusatztexte bewusst ausgeblendet.
}

function updateActiveMotifColorButton(color, label) {
  motifColorButtons.forEach(button => {
    const matchesColor = (button.dataset.color || "").toLowerCase() === String(color || "").toLowerCase();
    const matchesLabel = (button.dataset.name || "") === (label || "");
    button.classList.toggle("active", matchesColor && matchesLabel);
  });
}

enhanceMotifColorCards();

function getBaseSrc(view) {
  return view === "back" ? "shirt-back-template.png" : "shirt-front-template.png";
}

function getBaseImage(view) {
  return new Promise((resolve, reject) => {
    if (baseImages[view] && baseImages[view].complete) return resolve(baseImages[view]);
    const img = new Image();
    img.onload = () => { baseImages[view] = img; resolve(img); };
    img.onerror = reject;
    img.src = getBaseSrc(view);
  });
}

async function renderShirt() {
  const viewAtStart = currentView;
  try {
    const base = await getBaseImage(viewAtStart);
    if (viewAtStart !== currentView) return;
    if (currentShirtColorId === "weiss") {
      shirtMockup.src = getBaseSrc(currentView);
      return;
    }
    const c = document.createElement("canvas");
    c.width = base.naturalWidth || base.width;
    c.height = base.naturalHeight || base.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = currentShirtColorId === "black" ? "#3a3a3d" : currentShirtColor;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(base, 0, 0, c.width, c.height);
    if (currentPattern === "heather") {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, Math.round(c.width / 900));
      const step = Math.max(7, Math.round(c.width / 130));
      for (let x = -c.height; x < c.width + c.height; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + c.height, c.height); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    shirtMockup.src = c.toDataURL("image/png");
  } catch (err) {
    console.error("Shirt rendering failed", err);
    shirtMockup.src = getBaseSrc(currentView);
  }
}

function getActiveObject() { return canvas.getActiveObject(); }
function saveCurrentView() { viewStates[currentView] = canvas.toJSON(["motifId", "motifSrc", "motifColor", "motifColorLabel"]); }

function loadView(view) {
  canvas.clear();
  canvas.backgroundColor = "transparent";
  const state = viewStates[view];
  if (state) canvas.loadFromJSON(state, () => {
    canvas.getObjects().forEach(obj => {
      if (obj && obj.motifId) applyFixedMotifLayout(obj, obj.motifId);
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  });
  else canvas.requestRenderAll();
}

function switchView(view) {
  if (view === currentView) return;
  saveCurrentView();
  currentView = view;
  viewButtons.forEach(button => button.classList.toggle("active", button.dataset.view === view));
  if (view === "front") {
    shirtMockup.alt = "T-Shirt Vorderseite";
    designerStatus.textContent = "Vorderseite";
    printZone.classList.remove("back");
    canvas.setHeight(330); canvas.setWidth(260);
  } else {
    shirtMockup.alt = "T-Shirt Rückseite";
    designerStatus.textContent = "Rückseite";
    printZone.classList.add("back");
    canvas.setHeight(350); canvas.setWidth(260);
  }
  renderShirt();
  loadView(view);
}

viewButtons.forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));

function changeShirtColor(color, name, colorId, pattern) {
  currentShirtColor = color || "#ffffff";
  currentShirtColorId = colorId || "weiss";
  currentPattern = pattern || "";
  currentColorName.textContent = name || "White";
  shirtColorButtons.forEach(button => button.classList.toggle("active", button.dataset.id === currentShirtColorId));
  renderShirt();
}

shirtColorButtons.forEach(button => button.addEventListener("click", () => {
  changeShirtColor(button.dataset.color, button.dataset.name, button.dataset.id, button.dataset.pattern || "");
}));

function hexToRgb(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(normalized.slice(0,2), 16),
    g: parseInt(normalized.slice(2,4), 16),
    b: parseInt(normalized.slice(4,6), 16)
  };
}

function loadNativeImage(src) {
  return new Promise((resolve, reject) => {
    if (motifSourceCache.has(src)) return resolve(motifSourceCache.get(src));
    const img = new Image();
    img.onload = () => { motifSourceCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

async function recolorMotifSource(src, color) {
  const img = await loadNativeImage(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const imageData = ctx.getImageData(0, 0, c.width, c.height);
  const data = imageData.data;
  const rgb = hexToRgb(color);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    // Preserve original transparency/anti-aliasing; all visible motif pixels get the chosen print color.
    data[i] = rgb.r; data[i + 1] = rgb.g; data[i + 2] = rgb.b;
  }
  ctx.putImageData(imageData, 0, 0);
  return c.toDataURL("image/png");
}

const FIXED_MOTIF_LAYOUTS = {
  college: { left: 0.50, top: 0.31, maxWidth: 0.72, maxHeight: 0.36 },
  script:  { left: 0.50, top: 0.31, maxWidth: 0.72, maxHeight: 0.36 }
};

function applyFixedMotifLayout(image, motifId) {
  const layout = FIXED_MOTIF_LAYOUTS[motifId] || FIXED_MOTIF_LAYOUTS.college;
  const maxWidth = canvas.width * layout.maxWidth;
  const maxHeight = canvas.height * layout.maxHeight;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  image.set({
    left: canvas.width * layout.left,
    top: canvas.height * layout.top,
    originX: "center", originY: "center",
    angle: 0,
    scaleX: scale, scaleY: scale,
    selectable: false, evented: false,
    hasControls: false, hasBorders: false,
    lockMovementX: true, lockMovementY: true,
    lockScalingX: true, lockScalingY: true,
    lockRotation: true,
    hoverCursor: "default"
  });
  image.setCoords();
}

function configureFabricImage(image, motifId, motifSrc) {
  applyFixedMotifLayout(image, motifId);
  image.set({
    motifId, motifSrc,
    motifColor: currentMotifColor,
    motifColorLabel: currentMotifColorLabel
  });
}

async function addSelectedMotif(motifId, motifSrc) {
  if (currentView !== "front") switchView("front");
  // Give loadView() a moment when switching from the back.
  await new Promise(resolve => requestAnimationFrame(resolve));
  try {
    const dataUrl = await recolorMotifSource(motifSrc, currentMotifColor);
    canvas.clear();
    canvas.backgroundColor = "transparent";
    fabric.Image.fromURL(dataUrl, function(image) {
      configureFabricImage(image, motifId, motifSrc);
      canvas.add(image);
      canvas.discardActiveObject();
      image.setCoords();
      canvas.requestRenderAll();
      viewStates.front = canvas.toJSON(["motifId", "motifSrc", "motifColor", "motifColorLabel"]);
      motifButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.motif === motifId));
    }, { crossOrigin: "anonymous" });
  } catch (err) {
    console.error("Motiv konnte nicht geladen werden", err);
    alert("Das Motiv konnte nicht geladen werden. Bitte Seite neu laden.");
  }
}

motifButtons.forEach(button => button.addEventListener("click", () => {
  addSelectedMotif(button.dataset.motif, button.dataset.src);
}));

async function recolorActiveMotif(color, label) {
  currentMotifColor = color;
  currentMotifColorLabel = label;
  currentMotifColorName.textContent = label;
  updateActiveMotifColorButton(color, label);

  // Die Motive sind absichtlich nicht auswählbar. Daher direkt das feste Motiv einfärben.
  if (currentView !== "front") {
    switchView("front");
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  const object = canvas.getObjects().find(obj => obj && obj.motifSrc && obj.type === "image");
  if (!object) return;

  const oldWidth = object.getScaledWidth();
  const oldHeight = object.getScaledHeight();
  try {
    const dataUrl = await recolorMotifSource(object.motifSrc, color);
    object.setSrc(dataUrl, () => {
      const targetScale = Math.min(oldWidth / object.width, oldHeight / object.height);
      object.set({ motifColor: color, motifColorLabel: label });
      applyFixedMotifLayout(object, object.motifId || "college");
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveCurrentView();
    }, { crossOrigin: "anonymous" });
  } catch (err) {
    console.error("Motivfarbe konnte nicht angewendet werden", err);
  }
}

motifColorButtons.forEach(button => button.addEventListener("click", () => {
  recolorActiveMotif(button.dataset.color, button.dataset.name);
}));

resetBtn.addEventListener("click", function() {
  viewStates.front = null; viewStates.back = null;
  canvas.clear(); canvas.backgroundColor = "transparent";
  currentView = "front";
  designerStatus.textContent = "Vorderseite";
  printZone.classList.remove("back");
  canvas.setWidth(260); canvas.setHeight(330);
  viewButtons.forEach(button => button.classList.toggle("active", button.dataset.view === "front"));
  motifButtons.forEach(button => button.classList.remove("active"));
  changeShirtColor("#ffffff", "White", "weiss", "");
  recolorActiveMotif("#000000", "Black");
  canvas.requestRenderAll();
});

canvas.on("object:modified", function(event) {
  const object = event.target;
  if (!object) return;
  object.setCoords();
  const bounds = object.getBoundingRect(true, true);
  let left = object.left, top = object.top;
  if (bounds.left < 0) left += -bounds.left;
  if (bounds.left + bounds.width > canvas.width) left -= bounds.left + bounds.width - canvas.width;
  if (bounds.top < 0) top += -bounds.top;
  if (bounds.top + bounds.height > canvas.height) top -= bounds.top + bounds.height - canvas.height;
  object.set({ left, top }); object.setCoords(); canvas.requestRenderAll(); saveCurrentView();
});



// v14: Mehrere unterschiedliche Shirts in einer Bestellung
const shirtSize = document.getElementById("shirtSize");
const shirtQuantity = document.getElementById("shirtQuantity");
const addToOrderBtn = document.getElementById("addToOrderBtn");
const orderBtn = document.getElementById("orderBtn");
const orderMessage = document.getElementById("orderMessage");
const cartBox = document.getElementById("cartBox");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const orderModal = document.getElementById("orderModal");
const orderSummary = document.getElementById("orderSummary");
const orderForm = document.getElementById("orderForm");
const formOrderItems = document.getElementById("formOrderItems");
const formTotalQuantity = document.getElementById("formTotalQuantity");
const sendOrderMessage = document.getElementById("sendOrderMessage");

let orderItems = [];

function getSelectedMotifName() {
  const active = document.querySelector(".motif-btn.active");
  if (!active) return "Noch kein Motiv gewählt";
  return active.textContent.replace(/\s+/g, " ").trim();
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  row.className = "order-summary-row";
  const key = document.createElement("span");
  key.textContent = label;
  const val = document.createElement("strong");
  val.textContent = value;
  row.append(key, val);
  return row;
}

function getCurrentShirtSelection() {
  const size = shirtSize.value;
  const quantity = Math.max(1, Math.min(99, Number(shirtQuantity.value) || 1));
  shirtQuantity.value = quantity;
  const activeMotif = document.querySelector(".motif-btn.active");

  if (!size) {
    orderMessage.textContent = "Bitte zuerst eine Größe auswählen.";
    shirtSize.focus();
    return null;
  }
  if (!activeMotif) {
    orderMessage.textContent = "Bitte zuerst ein Motiv auswählen.";
    return null;
  }

  return {
    id: Date.now() + Math.random(),
    shirtColor: currentColorName.textContent || "White",
    motif: getSelectedMotifName(),
    motifColor: currentMotifColorName.textContent || currentMotifColorLabel,
    size,
    quantity
  };
}

function renderCart() {
  const total = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  cartBox.hidden = orderItems.length === 0;
  cartCount.textContent = `${total} ${total === 1 ? "Shirt" : "Shirts"}`;
  cartItems.replaceChildren();

  orderItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "cart-item";

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const title = document.createElement("strong");
    title.textContent = `${item.quantity}× ${item.size} · ${item.shirtColor}`;
    const meta = document.createElement("span");
    meta.textContent = `${item.motif} · ${item.motifColor}`;
    info.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-remove";
    remove.textContent = "Entfernen";
    remove.setAttribute("aria-label", `Position ${index + 1} entfernen`);
    remove.addEventListener("click", () => {
      orderItems.splice(index, 1);
      renderCart();
    });

    card.append(info, remove);
    cartItems.appendChild(card);
  });
}

function addCurrentShirtToOrder() {
  orderMessage.textContent = "";
  const item = getCurrentShirtSelection();
  if (!item) return;

  // Gleiche Kombinationen werden automatisch zusammengefasst.
  const existing = orderItems.find(entry =>
    entry.shirtColor === item.shirtColor &&
    entry.motif === item.motif &&
    entry.motifColor === item.motifColor &&
    entry.size === item.size
  );

  if (existing) existing.quantity = Math.min(99, existing.quantity + item.quantity);
  else orderItems.push(item);

  renderCart();
  orderMessage.textContent = "Shirt wurde zur Bestellung hinzugefügt. Du kannst jetzt Farbe, Motiv oder Größe ändern und ein weiteres Shirt hinzufügen.";
  orderMessage.classList.add("success");
}

function orderItemsAsText() {
  return orderItems.map((item, i) =>
    `${i + 1}. ${item.quantity}x | Größe ${item.size} | Shirt: ${item.shirtColor} | Motiv: ${item.motif} | Motivfarbe: ${item.motifColor}`
  ).join("\n");
}

function openOrderSummary() {
  orderMessage.textContent = "";
  orderMessage.classList.remove("success");
  if (!orderItems.length) {
    orderMessage.textContent = "Bitte zuerst mindestens ein Shirt zur Bestellung hinzufügen.";
    return;
  }

  const total = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  orderSummary.replaceChildren();

  orderItems.forEach((item, i) => {
    orderSummary.appendChild(summaryRow(
      `Shirt ${i + 1}`,
      `${item.quantity}× ${item.size} · ${item.shirtColor} · ${item.motif} · ${item.motifColor}`
    ));
  });
  orderSummary.appendChild(summaryRow("Gesamtmenge", String(total)));

  formOrderItems.value = orderItemsAsText();
  formTotalQuantity.value = String(total);
  if (sendOrderMessage) {
    sendOrderMessage.textContent = "";
    sendOrderMessage.classList.remove("success");
  }

  orderModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeOrderSummary() {
  orderModal.hidden = true;
  document.body.style.overflow = "";
}

if (addToOrderBtn) addToOrderBtn.addEventListener("click", addCurrentShirtToOrder);
if (orderBtn) orderBtn.addEventListener("click", openOrderSummary);
document.querySelectorAll("[data-close-order]").forEach(el => el.addEventListener("click", closeOrderSummary));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !orderModal.hidden) closeOrderSummary(); });

if (orderForm) {
  orderForm.addEventListener("submit", (event) => {
    const name = document.getElementById("customerName").value.trim();
    const customerClass = document.getElementById("customerClass").value.trim();
    const email = document.getElementById("customerEmail").value.trim();

    if (!orderItems.length) {
      event.preventDefault();
      sendOrderMessage.textContent = "Die Bestellung enthält noch keine Shirts.";
      return;
    }
    if (!name || !customerClass || !email) {
      event.preventDefault();
      sendOrderMessage.textContent = "Bitte Name, Klasse/Abteilung und E-Mail vollständig ausfüllen.";
      return;
    }

    // Kurz vor dem Versand sicherstellen, dass die aktuellen Daten im Formular stehen.
    formOrderItems.value = orderItemsAsText();
    formTotalQuantity.value = String(orderItems.reduce((sum, item) => sum + item.quantity, 0));
    sendOrderMessage.textContent = "Bestellung wird gesendet …";
    sendOrderMessage.classList.add("success");
  });
}

changeShirtColor("#ffffff", "White", "weiss", "");
  recolorActiveMotif("#000000", "Black");
  canvas.requestRenderAll();
});

canvas.on("object:modified", function(event) {
  const object = event.target;
  if (!object) return;
  object.setCoords();
  const bounds = object.getBoundingRect(true, true);
  let left = object.left, top = object.top;
  if (bounds.left < 0) left += -bounds.left;
  if (bounds.left + bounds.width > canvas.width) left -= bounds.left + bounds.width - canvas.width;
  if (bounds.top < 0) top += -bounds.top;
  if (bounds.top + bounds.height > canvas.height) top -= bounds.top + bounds.height - canvas.height;
  object.set({ left, top }); object.setCoords(); canvas.requestRenderAll(); saveCurrentView();
});



// v11: Größe, Menge und Bestellübersicht
const shirtSize = document.getElementById("shirtSize");
const shirtQuantity = document.getElementById("shirtQuantity");
const orderBtn = document.getElementById("orderBtn");
const orderMessage = document.getElementById("orderMessage");
const orderModal = document.getElementById("orderModal");
const orderSummary = document.getElementById("orderSummary");

const orderForm = document.getElementById("orderForm");
const formShirtColor = document.getElementById("formShirtColor");
const formMotif = document.getElementById("formMotif");
const formMotifColor = document.getElementById("formMotifColor");
const formSize = document.getElementById("formSize");
const formQuantity = document.getElementById("formQuantity");
const sendOrderMessage = document.getElementById("sendOrderMessage");

function getSelectedMotifName() {
  const active = document.querySelector(".motif-btn.active");
  if (!active) return "Noch kein Motiv gewählt";
  return active.textContent.replace(/\s+/g, " ").trim();
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  row.className = "order-summary-row";
  const key = document.createElement("span");
  key.textContent = label;
  const val = document.createElement("strong");
  val.textContent = value;
  row.append(key, val);
  return row;
}

function openOrderSummary() {
  const size = shirtSize.value;
  const quantity = Math.max(1, Math.min(99, Number(shirtQuantity.value) || 1));
  shirtQuantity.value = quantity;
  orderMessage.textContent = "";

  if (!size) {
    orderMessage.textContent = "Bitte zuerst eine Größe auswählen.";
    shirtSize.focus();
    return;
  }
  const activeMotif = document.querySelector(".motif-btn.active");
  if (!activeMotif) {
    orderMessage.textContent = "Bitte zuerst ein Motiv auswählen.";
    return;
  }

  const shirtColorValue = currentColorName.textContent || "White";
  const motifValue = getSelectedMotifName();
  const motifColorValue = currentMotifColorName.textContent || currentMotifColorLabel;

  orderSummary.replaceChildren(
    summaryRow("T-Shirt Farbe", shirtColorValue),
    summaryRow("Motiv", motifValue),
    summaryRow("Motivfarbe", motifColorValue),
    summaryRow("Größe", size),
    summaryRow("Menge", String(quantity))
  );

  formShirtColor.value = shirtColorValue;
  formMotif.value = motifValue;
  formMotifColor.value = motifColorValue;
  formSize.value = size;
  formQuantity.value = String(quantity);
  if (sendOrderMessage) {
    sendOrderMessage.textContent = "";
    sendOrderMessage.classList.remove("success");
  }

  orderModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeOrderSummary() {
  orderModal.hidden = true;
  document.body.style.overflow = "";
}

if (orderBtn) orderBtn.addEventListener("click", openOrderSummary);
document.querySelectorAll("[data-close-order]").forEach(el => el.addEventListener("click", closeOrderSummary));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !orderModal.hidden) closeOrderSummary(); });


// v13: Validierung vor dem Versand. Der eigentliche Versand läuft über FormSubmit.
if (orderForm) {
  orderForm.addEventListener("submit", (event) => {
    const name = document.getElementById("customerName").value.trim();
    const customerClass = document.getElementById("customerClass").value.trim();
    const email = document.getElementById("customerEmail").value.trim();

    if (!name || !customerClass || !email) {
      event.preventDefault();
      sendOrderMessage.textContent = "Bitte Name, Klasse/Abteilung und E-Mail vollständig ausfüllen.";
      return;
    }

    sendOrderMessage.textContent = "Bestellung wird gesendet …";
    sendOrderMessage.classList.add("success");
  });
}

changeShirtColor("#ffffff", "White", "weiss", "");
