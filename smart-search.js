(function initializeSmartSearch(root, factory) {
  const smartSearch = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = smartSearch;
  if (root) root.skillmateSmartSearch = smartSearch;
}(typeof window !== "undefined" ? window : null, () => {
  const synonymGroups = [
    ["tech help", "tech support", "it support", "technology", "laptop", "laptops", "computer", "computers", "phone", "phones", "device", "devices", "software", "setup", "troubleshooting"],
    ["repair", "repairs", "fix", "fixes", "fixing", "broken", "maintenance", "restore"],
    ["hair", "beauty", "barber", "barbers", "barbering", "haircut", "haircuts", "braids", "braiding", "hairstyle", "hairstyles", "styling"],
    ["tutor", "tutors", "tutoring", "teach", "teaching", "lesson", "lessons", "study", "studying"],
    ["design", "designer", "designers", "graphic", "graphics", "logo", "logos", "poster", "posters", "branding"],
    ["food", "meal", "meals", "lunch", "cooking", "cook", "catering", "baking", "baker"],
    ["cleaning", "cleaner", "cleaners", "clean", "tidy", "tidying", "housekeeping"],
    ["photo", "photos", "photography", "photographer", "photographers", "picture", "pictures"],
    ["fashion", "tailor", "tailoring", "sewing", "alteration", "alterations", "clothes", "clothing"],
    ["fitness", "workout", "workouts", "exercise", "exercising", "wellness", "training", "trainer"],
    ["writing", "writer", "writers", "editing", "editor", "proofreading", "proofread", "essay", "essays"],
    ["event", "events", "entertainment", "music", "dj", "djs", "party", "parties", "host", "hosting"],
    ["errand", "errands", "delivery", "deliveries", "deliver", "courier", "pickup", "pickups"],
    ["laundry", "washing", "ironing", "wash", "clothes"],
    ["moving", "move", "搬"],
    ["bike", "bikes", "bicycle", "bicycles", "cycling"],
    ["appliance", "appliances", "fridge", "refrigerator", "microwave", "fan"],
    ["home maintenance", "handyman", "handywork", "plumbing", "electrician", "carpentry", "carpenter"],
  ];

  const groupsByTerm = new Map();
  for (const group of synonymGroups) {
    const normalizedGroup = group.flatMap((term) => normalize(term).split(" "));
    for (const term of normalizedGroup) groupsByTerm.set(term, normalizedGroup);
  }
  const broadRepairTerms = new Set(["repair", "repairs", "fix", "fixes", "fixing", "broken", "maintenance", "restore"]);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function editDistanceAtMostOne(left, right) {
    if (Math.abs(left.length - right.length) > 1) return false;
    let i = 0;
    let j = 0;
    let differences = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        i += 1;
        j += 1;
      } else {
        differences += 1;
        if (differences > 1) return false;
        if (left.length > right.length) i += 1;
        else if (right.length > left.length) j += 1;
        else {
          i += 1;
          j += 1;
        }
      }
    }
    if (i < left.length || j < right.length) differences += 1;
    return differences <= 1;
  }

  function matches(provider, query) {
    const allQueryTerms = normalize(query).split(" ").filter((term) => term.length > 1);
    const specificQueryTerms = allQueryTerms.filter((term) => !broadRepairTerms.has(term));
    const queryTerms = specificQueryTerms.length ? specificQueryTerms : allQueryTerms;
    if (!queryTerms.length) return true;

    const category = normalize(provider.category);
    const service = normalize(provider.service || provider.title);
    const name = normalize(provider.name);
    const description = normalize([provider.description, provider.course, provider.campus].join(" "));
    const categoryTerms = synonymGroups
      .filter((group) => group.some((term) => category.includes(normalize(term))))
      .flat();
    const fields = {
      primary: normalize([service, category, ...categoryTerms].join(" ")).split(" "),
      name: name.split(" "),
      description: description.split(" "),
    };

    return queryTerms.every((queryTerm) => {
      const candidateTerms = new Set([queryTerm, ...(groupsByTerm.get(queryTerm) || [])]);
      for (const candidates of Object.values(fields)) {
        for (const candidateTerm of candidateTerms) {
          if (candidateTerm.length < 2) continue;
          if (candidates.some((word) => word === candidateTerm
            || (candidateTerm.length >= 3 && word.startsWith(candidateTerm))
            || (word.length >= 4 && candidateTerm.length >= 4 && editDistanceAtMostOne(word, candidateTerm)))) {
            return true;
          }
        }
      }
      return false;
    });
  }

  return { matches, normalize };
}));
