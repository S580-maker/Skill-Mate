(() => {
  const utils = window.skillmateServiceUtils;
  const byId = id => document.getElementById(`service-${id}`);
  const form = byId("form");
  const modal = byId("modal");
  const fields = byId("fields");
  const submit = byId("submit");
  const feedback = byId("form-feedback");
  let existing = null;
  let draftId = "";
  let coverFile = null;
  let coverPath = null;
  let coverUrl = "";
  let blobUrl = "";
  let generation = 0;
  let busy = false;
  let imageBusy = false;
  let reviewing = false;
  let extended = !appSupabase;
  let schemaChecking = false;
  let opener = null;
  const unusedCoverCandidates = new Set();

  async function cleanUnusedCovers() {
    if (!appSupabase || !appUser?.id) return;
    for (const path of [...unusedCoverCandidates]) {
      if (!path.startsWith(`${appUser.id}/`)) continue;
      try {
        // Only covers replaced by an acknowledged save enter this set. Confirm
        // that no other visible listing references the old image before removal.
        const { data, error } = await appSupabase.from("services").select("id").eq("cover_image_path", path).limit(1);
        if (error) continue;
        if (!data?.length) {
          const result = await appSupabase.storage.from("service-covers").remove([path]);
          if (result.error) continue;
        }
        unusedCoverCandidates.delete(path);
      } catch { /* Leave uncertain files intact; cleanup can be retried later. */ }
    }
  }

  function showFeedback(message, state = "error") {
    feedback.hidden = !message;
    feedback.dataset.state = state;
    feedback.textContent = message;
  }
  function setError(id, message = "") {
    const input = byId(id);
    const error = byId(`${id}-error`);
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
    input.setAttribute("aria-invalid", String(Boolean(message)));
  }
  function clearErrors() {
    for (const id of ["title", "category", "description", "delivery", "price", "price-type", "estimate", "cover"]) setError(id);
    showFeedback("");
  }
  function applyAvailability() {
    form.querySelectorAll("[data-service-extended]").forEach(input => { input.disabled = !extended || busy || imageBusy; });
    submit.disabled = busy || imageBusy || schemaChecking;
  }
  async function checkSchema(token) {
    if (!appSupabase) return;
    schemaChecking = true;
    extended = false;
    const status = byId("schema-status");
    status.hidden = false;
    status.textContent = "Checking available listing options…";
    applyAvailability();
    try {
      const { error } = await appSupabase.from("services")
        .select("cover_image_path, delivery_method, estimated_delivery, price_type").limit(0);
      if (token !== generation) return;
      extended = !error;
      status.hidden = extended;
      status.textContent = error
        ? "Extra listing options are unavailable. You can still save the original service details. Reopen this form after setup or your connection is restored."
        : "";
    } catch {
      if (token !== generation) return;
      status.textContent = "Could not check extra listing options. You can still save the original service details.";
    } finally {
      if (token === generation) { schemaChecking = false; applyAvailability(); }
    }
  }
  function releaseBlob() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = "";
  }
  function paintCover() {
    for (const id of ["cover-preview", "review-cover"]) {
      const img = byId(id);
      img.hidden = !coverUrl;
      if (coverUrl) img.src = coverUrl;
      else img.removeAttribute("src");
    }
    byId("cover-remove").hidden = !coverUrl;
    byId("review-symbol").hidden = Boolean(coverUrl);
  }
  function updateHints() {
    const [title, description] = utils.example(byId("category").value);
    byId("title").placeholder = `e.g. ${title}`;
    byId("description").placeholder = description;
    byId("description-count").textContent = `${byId("description").value.length.toLocaleString()} / 2,000`;
    byId("price-hint").textContent = byId("price-type").value === "starting"
      ? "Show the minimum price. Agree the full scope and final price with the student before confirming a booking."
      : "The price covers the scope described above.";
  }
  function setReview(value, focus = true) {
    reviewing = value;
    fields.hidden = value;
    byId("review").hidden = !value;
    byId("back").hidden = !value;
    byId("footer-hint").hidden = value;
    byId("editor-step").textContent = value ? "2 of 2 · Review your listing" : "1 of 2 · Service details";
    submit.textContent = value ? (existing ? "Save changes" : "Publish service") : "Preview service →";
    if (value) {
      const draft = readDraft();
      byId("review-name").textContent = draft.title;
      byId("review-category").textContent = draft.category;
      byId("review-description").textContent = draft.description;
      byId("review-price").textContent = `${draft.priceType === "starting" ? "From " : ""}${currency(draft.price)}`;
      byId("review-symbol").textContent = getCategoryIcon(draft.category);
      const tags = [utils.deliveryLabels[draft.deliveryMethod], draft.estimatedDelivery, draft.groups && "Groups welcome"].filter(Boolean);
      byId("review-tags").replaceChildren(...tags.map(text => {
        const tag = document.createElement("span"); tag.textContent = text; return tag;
      }));
      paintCover();
    }
    if (focus) {
      byId(value ? "review-title" : "title").focus({ preventScroll: true });
      form.querySelector(".service-editor-body").scrollTop = 0;
    }
  }
  function readDraft() {
    return {
      title: byId("title").value.trim(), category: byId("category").value,
      description: byId("description").value.trim(), price: byId("price").value,
      groups: byId("group").checked,
      deliveryMethod: extended ? byId("delivery").value : existing?.deliveryMethod || "",
      priceType: extended ? byId("price-type").value : existing?.priceType || "fixed",
      estimatedDelivery: extended ? byId("estimate").value.trim() : existing?.estimatedDelivery || "",
    };
  }
  function validate() {
    clearErrors();
    const errors = utils.validate(readDraft(), serviceCategories, extended);
    Object.entries(errors).forEach(([id, message]) => setError(id, message));
    const first = Object.keys(errors)[0];
    if (first) {
      setReview(false, false);
      if (byId(first).closest("details")) byId("options").open = true;
      byId(first).focus();
      showFeedback("Check the highlighted fields before continuing.");
    }
    return !first;
  }
  function prepare(service = null) {
    generation++;
    opener = document.activeElement;
    existing = service;
    draftId = service?.id || crypto.randomUUID();
    form.reset();
    clearErrors();
    releaseBlob();
    coverFile = null;
    imageBusy = false;
    coverPath = service?.coverImagePath || null;
    coverUrl = serviceCoverUrl(service || {});
    byId("id").value = service?.id || "";
    byId("title").value = service?.title || "";
    byId("category").value = service?.category || serviceCategories[0];
    byId("description").value = service?.description || "";
    byId("price").value = service?.price ?? "";
    byId("delivery").value = service?.deliveryMethod || "";
    byId("price-type").value = service?.priceType || "fixed";
    byId("estimate").value = service?.estimatedDelivery || "";
    byId("group").checked = Boolean(service?.groups);
    byId("options").open = true;
    byId("modal-title").textContent = service ? "Edit your service" : "Add a service";
    setReview(false, false);
    updateHints();
    paintCover();
    checkSchema(generation);
  }
  window.skillmateServiceEditor = { prepare };

  form.addEventListener("input", event => {
    if (event.target.id.startsWith("service-")) setError(event.target.id.slice(8));
    updateHints();
  });
  byId("category").addEventListener("change", updateHints);
  byId("back").addEventListener("click", () => { clearErrors(); setReview(false); });
  byId("cover-remove").addEventListener("click", () => {
    releaseBlob(); coverUrl = ""; coverPath = null; coverFile = null;
    byId("cover").value = ""; setError("cover"); paintCover();
  });
  byId("cover").addEventListener("change", async () => {
    const file = byId("cover").files[0];
    if (!file) return;
    const token = generation;
    imageBusy = true;
    byId("cover").disabled = true;
    byId("cover-remove").disabled = true;
    applyAvailability();
    setError("cover");
    showFeedback("Preparing your cover image…", "loading");
    try {
      // Check type, signature, size and decoded dimensions, then re-encode to
      // remove original metadata and upload a bounded, browser-generated image.
      if (file.size > utils.MAX_IMAGE_BYTES) throw new Error("Choose an image up to 5 MB.");
      utils.validateImageHeader(file, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
      const bitmap = await createImageBitmap(file);
      let output;
      try {
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16_000_000) throw new Error("Choose an image with no more than 16 megapixels.");
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        output = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.88));
      } finally { bitmap.close(); }
      if (!output || output.size > utils.MAX_IMAGE_BYTES || !["image/webp", "image/png"].includes(output.type)) throw new Error("This image could not be prepared. Try another JPG, PNG or WebP.");
      if (token !== generation) return;
      releaseBlob(); coverFile = output; blobUrl = URL.createObjectURL(output); coverUrl = blobUrl;
      paintCover();
      showFeedback("Cover image ready for your preview.", "success");
    } catch (error) {
      if (token === generation) {
        setError("cover", error.message || "This image could not be read. Choose another image.");
        showFeedback("");
        byId("cover").value = "";
      }
    } finally {
      if (token === generation) { imageBusy = false; applyAvailability(); }
    }
  });

  function setBusy(value) {
    busy = value;
    fields.disabled = value;
    byId("back").disabled = value;
    modal.querySelector("[data-close]").disabled = value;
    form.setAttribute("aria-busy", String(value));
    applyAvailability();
  }
  modal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  modal.addEventListener("click", event => {
    if (busy && (event.target === modal || event.target.closest("[data-close]"))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  modal.addEventListener("close", () => {
    generation++; releaseBlob(); coverFile = null; schemaChecking = false;
    cleanUnusedCovers();
    const target = opener?.isConnected ? opener : document.querySelector('[data-open="service-modal"]');
    target?.focus();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || imageBusy || schemaChecking || !validate()) return;
    if (!reviewing) { setReview(true); return; }
    const draft = readDraft();
    const operationGeneration = generation;
    setBusy(true);
    submit.textContent = "Saving…";
    showFeedback("Saving your service…", "loading");
    try {
      let saved;
      if (appSupabase) {
        if (!appUser?.id) throw new Error("Your session has expired. Sign in again before saving.");
        if (extended && coverFile) {
          const path = `${appUser.id}/${crypto.randomUUID()}.${coverFile.type === "image/png" ? "png" : "webp"}`;
          const { error } = await appSupabase.storage.from("service-covers").upload(path, coverFile, { contentType: coverFile.type, upsert: false });
          if (error) throw new Error("The cover could not be uploaded. Check your connection and listing-image setup, then try again.");
          // Retain the path for retries: an interrupted DB response may have committed.
          coverPath = path; coverFile = null;
        }
        const payload = utils.payload(draft, appUser.id, coverPath, extended);
        const query = existing
          ? appSupabase.from("services").update(payload).eq("id", existing.id).eq("provider_id", appUser.id)
          : appSupabase.from("services").upsert({ id: draftId, ...payload }, { onConflict: "id" });
        const { data, error } = await query.select("*").single();
        if (error) throw new Error("We couldn't save your service. Check your connection and try again. Your details are still here.");
        saved = { id: data.id, title: data.title, category: data.category, price: Number(data.price), description: data.description,
          groups: data.accepts_groups, active: data.is_active, ...utils.metadata(data) };
        unusedCoverCandidates.delete(saved.coverImagePath);
        if (existing?.coverImagePath && existing.coverImagePath !== saved.coverImagePath) unusedCoverCandidates.add(existing.coverImagePath);
      } else {
        saved = { id: draftId, ...draft, price: Number(draft.price), active: existing?.active ?? true,
          coverImage: coverFile ? await readImage(coverFile) : coverUrl };
        const nextServices = [saved, ...state.services.filter(service => service.id !== saved.id)];
        // Let storage failures reach the form rather than claiming the draft was saved.
        localStorage.setItem(storageKey, JSON.stringify({ ...state, services: nextServices }));
      }
      state.services = [saved, ...state.services.filter(service => service.id !== saved.id)];
      setBusy(false);
      modal.close();
      renderListings();
      showToast(existing ? "Service updated." : appSupabase ? "Your service is now listed." : "Your service is saved in this demo.");
      // Publication has succeeded. A later refresh failure must not invite a duplicate insert.
      try {
        if (appSupabase) await refreshSupabaseState();
        populateServiceSelects(); renderAll();
      } catch {
        showToast("Your service was saved. The dashboard could not refresh; reload to see the latest listings.", "error");
      }
    } catch (error) {
      showFeedback(error.message || "Could not save your service. Your details are still here.");
      feedback.focus?.();
    } finally {
      if (operationGeneration === generation) {
        setBusy(false);
        submit.textContent = existing ? "Save changes" : "Publish service";
      }
    }
  });
})();
