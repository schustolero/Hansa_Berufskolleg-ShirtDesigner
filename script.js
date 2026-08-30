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

const centerBtn = document.getElementById("centerBtn");
const duplicateBtn = document.getElementById("duplicateBtn");
const deleteBtn = document.getElementById("deleteBtn");
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
  if (state) canvas.loadFromJSON(state, () => canvas.requestRenderAll());
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

function configureFabricImage(image, motifId, motifSrc) {
  const maxWidth = canvas.width * 0.70;
  const maxHeight = canvas.height * 0.48;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  image.set({
    left: canvas.width / 2,
    top: canvas.height / 2,
    originX: "center", originY: "center",
    scaleX: scale, scaleY: scale,
    selectable: true, evented: true,
    centeredRotation: true, centeredScaling: true,
    transparentCorners: false,
    cornerColor: "#ffffff", cornerStrokeColor: "#111111",
    borderColor: "#f28c00", cornerSize: 11, padding: 3,
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
      canvas.setActiveObject(image);
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
  motifColorButtons.forEach(button => button.classList.toggle("active", button.dataset.color.toLowerCase() === color.toLowerCase()));

  const object = getActiveObject();
  if (!object || !object.motifSrc || object.type !== "image") return;
  const oldWidth = object.getScaledWidth();
  const oldHeight = object.getScaledHeight();
  const oldLeft = object.left, oldTop = object.top, oldAngle = object.angle || 0;
  try {
    const dataUrl = await recolorMotifSource(object.motifSrc, color);
    object.setSrc(dataUrl, () => {
      const targetScale = Math.min(oldWidth / object.width, oldHeight / object.height);
      object.set({
        left: oldLeft, top: oldTop, angle: oldAngle,
        scaleX: targetScale, scaleY: targetScale,
        motifColor: color, motifColorLabel: label
      });
      object.setCoords();
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

centerBtn.addEventListener("click", function() {
  const object = getActiveObject();
  if (!object) return;
  object.set({ left: canvas.width / 2, top: canvas.height / 2, originX: "center", originY: "center" });
  object.setCoords(); canvas.requestRenderAll(); saveCurrentView();
});

duplicateBtn.addEventListener("click", function() {
  const object = getActiveObject();
  if (!object) return;
  object.clone(function(clone) {
    clone.set({ left: (object.left || 0) + 15, top: (object.top || 0) + 15 });
    canvas.add(clone); canvas.setActiveObject(clone); clone.setCoords(); canvas.requestRenderAll(); saveCurrentView();
  }, ["motifId", "motifSrc", "motifColor", "motifColorLabel"]);
});

function deleteSelected() {
  const activeObjects = canvas.getActiveObjects();
  if (!activeObjects.length) return;
  activeObjects.forEach(object => canvas.remove(object));
  canvas.discardActiveObject(); canvas.requestRenderAll(); saveCurrentView();
}

deleteBtn.addEventListener("click", deleteSelected);
document.addEventListener("keydown", function(event) {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) return;
  event.preventDefault(); deleteSelected();
});

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

canvas.on("selection:created", syncMotifColorFromSelection);
canvas.on("selection:updated", syncMotifColorFromSelection);
function syncMotifColorFromSelection() {
  const object = getActiveObject();
  if (!object || !object.motifColor) return;
  currentMotifColor = object.motifColor;
  currentMotifColorLabel = object.motifColorLabel || "Motivfarbe";
  currentMotifColorName.textContent = currentMotifColorLabel;
  motifColorButtons.forEach(button => button.classList.toggle("active", button.dataset.color.toLowerCase() === currentMotifColor.toLowerCase()));
}

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

changeShirtColor("#ffffff", "White", "weiss", "");
