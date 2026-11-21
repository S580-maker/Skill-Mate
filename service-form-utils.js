(function (root) {
  const MAX_IMAGE_BYTES = 5_000_000;
  const deliveryLabels = { online: "Online", in_person: "In person", both: "Online & in person" };
  const examples = {
    "Tech help": ["Laptop cleaning & tune-up", "A careful laptop clean, fan check and performance tune-up. Tell students what is included and what to bring."],
    "Hair & beauty": ["Knotless braids & protective styling", "Describe the styles you offer, what is included and whether students should bring their own hair or products."],
    Tutoring: ["Calculus revision, made simple", "Explain the topics and level you teach, session length and the practice materials students receive."],
    Design: ["Event posters for campus clubs", "Describe the design deliverables, file formats and number of revisions included in the price."],
    Food: ["Fresh homemade lunch boxes", "Describe your menu, portion sizes, collection arrangements and how students can ask about allergens."],
    Photography: ["Graduation portraits on campus", "Describe the shoot length, number of edited photos and when students can expect their gallery."],
    Cleaning: ["A fresh start for your hostel room", "List the areas you clean, supplies included and anything students should prepare before your visit."],
    "Writing & editing": ["Proofreading for clear, confident writing", "Describe the word count, editing scope and feedback included. Support original student work."],
    "Fashion & tailoring": ["Custom tailoring & wardrobe repairs", "Describe the garments you work with, fitting arrangements and whether materials are included."],
    "Fitness & wellness": ["Beginner-friendly fitness sessions", "Describe the session length, activity level, equipment and what participants should bring."],
    "Events & entertainment": ["Music for your next campus event", "Describe the performance or event support, duration and equipment included."],
    "Errands & delivery": ["Convenient errands around campus", "Describe the errands you cover, service area and any costs students pay separately."],
    Repairs: ["Small repairs, carefully handled", "Describe what you repair, your inspection process and whether replacement parts cost extra."],
    "Appliance repair": ["Small appliance troubleshooting", "List the appliances you assess, what the inspection covers and how you quote for parts."],
    "Bike repair": ["Bike tune-ups for campus commutes", "Describe the checks and adjustments included, and whether spare parts cost extra."],
    "Clothing alterations": ["Trouser hems & clothing alterations", "Describe the alterations offered, fitting arrangements and turnaround time."],
    "Home maintenance": ["Help with small home maintenance jobs", "Describe the tasks you handle, tools provided and materials that cost extra."],
    Laundry: ["Wash, fold & ready for the week", "Describe the load size, washing and folding included, and collection arrangements."],
    "Moving help": ["A helping hand on moving day", "Describe the number of helpers, time included and whether transport is provided."],
  };
  function example(category) {
    return examples[category] || ["A clear name for the skill you offer", "Explain what students receive, what is included in the price and anything they should prepare."];
  }
  function validate(draft, categories, extended) {
    const errors = {};
    if (draft.title.length < 3 || draft.title.length > 100) errors.title = "Use between 3 and 100 characters for your title.";
    if (!categories.includes(draft.category)) errors.category = "Choose a service category.";
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(draft.price)) || Number(draft.price) <= 0 || Number(draft.price) > 99999999.99) {
      errors.price = "Enter a price from GH₵ 0.01 to 99,999,999.99, with up to 2 decimal places.";
    }
    if (draft.description.length < 10 || draft.description.length > 2000) errors.description = "Use between 10 and 2,000 characters to describe your service.";
    if (extended && !deliveryLabels[draft.deliveryMethod]) errors.delivery = "Choose how you will deliver your service.";
    if (extended && draft.estimatedDelivery.length > 80) errors.estimate = "Keep your delivery estimate to 80 characters or fewer.";
    if (!["fixed", "negotiation", "hybrid", "range"].includes(draft.negotiationMode)) errors["negotiation-mode"] = "Choose a pricing option.";
    if (["negotiation", "hybrid", "range"].includes(draft.negotiationMode)
      && (!/^\d+(?:\.\d{1,2})?$/.test(String(draft.minimumPrice))
        || Number(draft.minimumPrice) <= 0
        || Number(draft.minimumPrice) > Number(draft.price))) {
      errors["minimum-price"] = draft.negotiationMode === "range"
        ? "Enter the low end of your range above GH₵ 0 and no higher than the high end."
        : "Enter a minimum price above GH₵ 0 and no higher than your listed price.";
    }
    return errors;
  }
  function normalizeNegotiationMode(mode) {
    if (mode === "controlled" || mode === "chat") return "negotiation";
    return ["fixed", "negotiation", "hybrid"].includes(mode) ? mode : "negotiation";
  }
  function validateImageHeader(file, bytes, maxBytes = MAX_IMAGE_BYTES) {
    if (!file.size || file.size > maxBytes) throw new Error(`Choose an image up to ${(maxBytes / 1_000_000).toFixed(0)} MB.`);
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(file.type === "image/jpeg" && jpeg || file.type === "image/png" && png || file.type === "image/webp" && webp)) {
      throw new Error("Choose a valid JPG, PNG or WebP image. SVG and GIF files are not supported.");
    }
  }
  async function compressImageFile(file, {
    maxDimension = 1600, quality = 0.84,
    maxInputBytes = MAX_IMAGE_BYTES, maxOutputBytes = MAX_IMAGE_BYTES,
  } = {}) {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
      throw new Error("Image compression is not supported by this browser. Try a current version of Chrome, Firefox or Safari.");
    }
    if (!file || file.size > maxInputBytes) throw new Error(`Choose an image smaller than ${(maxInputBytes / 1_000_000).toFixed(0)} MB.`);
    validateImageHeader(file, new Uint8Array(await file.slice(0, 12).arrayBuffer()), maxInputBytes);
    const bitmap = await createImageBitmap(file);
    let output;
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) {
        throw new Error("Choose an image with no more than 40 megapixels.");
      }
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This image could not be prepared. Try another image.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      output = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    } finally {
      bitmap.close();
    }
    if (!output || output.type !== "image/webp" || output.size > maxOutputBytes) {
      throw new Error("This image could not be compressed to a supported size. Try a smaller image.");
    }
    const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`;
    return new File([output], name, { type: "image/webp", lastModified: file.lastModified });
  }
  function metadata(row) {
    return { coverImagePath: row.cover_image_path || null, deliveryMethod: row.delivery_method || "",
      estimatedDelivery: row.estimated_delivery || "", priceType: row.price_type === "range" ? "range" : "fixed",
      minimumPrice: row.price_range_min ?? row.minimum_price ?? null,
      negotiationMode: normalizeNegotiationMode(row.negotiation_mode) };
  }
  function payload(draft, userId, coverPath, extended) {
    const result = { provider_id: userId, title: draft.title, category: draft.category,
      price: Number(draft.price), description: draft.description, accepts_groups: draft.groups };
    if (extended) Object.assign(result, { cover_image_path: coverPath || null, delivery_method: draft.deliveryMethod,
      estimated_delivery: draft.estimatedDelivery || null, price_type: draft.negotiationMode === "range" ? "range" : "fixed" });
    return result;
  }
  const api = { MAX_IMAGE_BYTES, deliveryLabels, example, validate, validateImageHeader, compressImageFile, normalizeNegotiationMode, metadata, payload };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.skillflexServiceUtils = api;
})(globalThis);
