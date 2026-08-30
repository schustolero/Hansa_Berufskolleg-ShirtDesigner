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

  if (cfg.accentColor) {
    document.documentElement.style.setProperty("--accent", cfg.accentColor);
  }

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

const imageUpload = document.getElementById("imageUpload");
const centerBtn = document.getElementById("centerBtn");
const duplicateBtn = document.getElementById("duplicateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const resetBtn = document.getElementById("resetBtn");
const viewButtons = document.querySelectorAll(".view-btn");
const shirtColorButtons = document.querySelectorAll(".shirt-color");
const shirtMockup = document.getElementById("shirtMockup");
const currentColorName = document.getElementById("currentColorName");
const designerStatus = document.getElementById("designerStatus");
const printZone = document.getElementById("printZone");

let currentView = "front";
let currentShirtColor = "#ffffff";
let currentShirtColorId = "weiss";
let currentPattern = "";

const viewStates = { front: null, back: null };
const baseImages = { front: null, back: null };

function getBaseSrc(view) {
  return view === "back" ? "shirt-back-template.png" : "shirt-front-template.png";
}

function getBaseImage(view) {
  return new Promise((resolve, reject) => {
    if (baseImages[view] && baseImages[view].complete) {
      resolve(baseImages[view]);
      return;
    }
    const img = new Image();
    img.onload = () => {
      baseImages[view] = img;
      resolve(img);
    };
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

    // Draw original white shirt first so folds, seams and shadows remain.
    ctx.drawImage(base, 0, 0, c.width, c.height);

    // Tint only existing shirt pixels. Multiply preserves luminance/detail.
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = currentShirtColorId === "black" ? "#3a3a3d" : currentShirtColor;
    ctx.fillRect(0, 0, c.width, c.height);

    // Restore the exact transparency silhouette of the base image.
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(base, 0, 0, c.width, c.height);

    // Heather/vintage: add a very subtle light fibre texture inside the shirt.
    if (currentPattern === "heather") {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, Math.round(c.width / 900));
      const step = Math.max(7, Math.round(c.width / 130));
      for (let x = -c.height; x < c.width + c.height; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + c.height, c.height);
        ctx.stroke();
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

function getActiveObject() {
  return canvas.getActiveObject();
}

function saveCurrentView() {
  viewStates[currentView] = canvas.toJSON();
}

function loadView(view) {
  canvas.clear();
  canvas.backgroundColor = "transparent";
  const state = viewStates[view];
  if (state) {
    canvas.loadFromJSON(state, () => canvas.requestRenderAll());
  } else {
    canvas.requestRenderAll();
  }
}

function switchView(view) {
  if (view === currentView) return;
  saveCurrentView();
  currentView = view;

  viewButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (view === "front") {
    shirtMockup.alt = "T-Shirt Vorderseite";
    designerStatus.textContent = "Vorderseite";
    printZone.classList.remove("back");
    canvas.setHeight(330);
    canvas.setWidth(260);
  } else {
    shirtMockup.alt = "T-Shirt Rückseite";
    designerStatus.textContent = "Rückseite";
    printZone.classList.add("back");
    canvas.setHeight(350);
    canvas.setWidth(260);
  }

  renderShirt();
  loadView(view);
}

viewButtons.forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

function changeShirtColor(color, name, colorId, pattern) {
  currentShirtColor = color || "#ffffff";
  currentShirtColorId = colorId || "weiss";
  currentPattern = pattern || "";
  currentColorName.textContent = name || "White";

  shirtColorButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.id === currentShirtColorId);
  });

  renderShirt();
}

shirtColorButtons.forEach(button => {
  button.addEventListener("click", () => {
    changeShirtColor(
      button.dataset.color,
      button.dataset.name,
      button.dataset.id,
      button.dataset.pattern || ""
    );
  });
});

function addImageToCanvas(dataUrl) {
  fabric.Image.fromURL(dataUrl, function(image) {
    const maxWidth = canvas.width * 0.62;
    const maxHeight = canvas.height * 0.46;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);

    image.set({
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
      selectable: true,
      evented: true,
      centeredRotation: true,
      centeredScaling: true,
      transparentCorners: false,
      cornerColor: "#ffffff",
      cornerStrokeColor: "#111111",
      borderColor: "#635bff",
      cornerSize: 11,
      padding: 3
    });

    canvas.add(image);
    canvas.setActiveObject(image);
    image.setCoords();
    canvas.requestRenderAll();
  }, { crossOrigin: "anonymous" });
}

imageUpload.addEventListener("change", function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Bitte wähle eine PNG-, JPG- oder WEBP-Datei aus.");
    imageUpload.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = e => addImageToCanvas(e.target.result);
  reader.readAsDataURL(file);
  imageUpload.value = "";
});

centerBtn.addEventListener("click", function() {
  const object = getActiveObject();
  if (!object) return;
  object.set({
    left: canvas.width / 2,
    top: canvas.height / 2,
    originX: "center",
    originY: "center"
  });
  object.setCoords();
  canvas.requestRenderAll();
});

duplicateBtn.addEventListener("click", function() {
  const object = getActiveObject();
  if (!object) return;
  object.clone(function(clone) {
    clone.set({ left: (object.left || 0) + 15, top: (object.top || 0) + 15 });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    clone.setCoords();
    canvas.requestRenderAll();
  });
});

function deleteSelected() {
  const activeObjects = canvas.getActiveObjects();
  if (!activeObjects.length) return;
  activeObjects.forEach(object => canvas.remove(object));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

deleteBtn.addEventListener("click", deleteSelected);

document.addEventListener("keydown", function(event) {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) return;
  event.preventDefault();
  deleteSelected();
});

resetBtn.addEventListener("click", function() {
  viewStates.front = null;
  viewStates.back = null;
  canvas.clear();
  canvas.backgroundColor = "transparent";
  currentView = "front";
  designerStatus.textContent = "Vorderseite";
  printZone.classList.remove("back");
  canvas.setWidth(260);
  canvas.setHeight(330);
  viewButtons.forEach(button => button.classList.toggle("active", button.dataset.view === "front"));
  changeShirtColor("#ffffff", "White", "weiss", "");
  canvas.requestRenderAll();
});

canvas.on("object:modified", function(event) {
  const object = event.target;
  if (!object) return;
  object.setCoords();
  const bounds = object.getBoundingRect(true, true);
  let left = object.left;
  let top = object.top;
  if (bounds.left < 0) left += -bounds.left;
  if (bounds.left + bounds.width > canvas.width) left -= bounds.left + bounds.width - canvas.width;
  if (bounds.top < 0) top += -bounds.top;
  if (bounds.top + bounds.height > canvas.height) top -= bounds.top + bounds.height - canvas.height;
  object.set({ left, top });
  object.setCoords();
  canvas.requestRenderAll();
});

changeShirtColor("#ffffff", "White", "weiss", "");
