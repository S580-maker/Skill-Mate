(() => {
  const container = document.querySelector("#profile-completeness-root");
  if (!window.React || !window.ReactDOM) {
    console.error("The profile completeness card could not load because React is unavailable.");
    return;
  }
  const root = ReactDOM.createRoot(container);

  function ProfileCompleteness({ profile }) {
    if (profile.identityComplete) return null;

    const fields = [
      Boolean(profile.name?.trim()),
      Boolean(profile.university?.trim()),
      Boolean(profile.studentIdNumber?.trim()),
    ];
    const completed = fields.filter(Boolean).length;
    const percentage = Math.round((completed / fields.length) * 100);
    const missing = [
      !fields[0] && "your name",
      !fields[1] && "your university",
      !fields[2] && "your student ID number",
    ].filter(Boolean);
    const detail = `Add ${missing.join(" and ")} to finish setting up your student profile.`;

    return React.createElement(
      "section",
      { className: "profile-completeness panel", "aria-labelledby": "profile-completeness-title" },
      React.createElement(
        "div",
        { className: "profile-completeness-copy" },
        React.createElement("p", { className: "eyebrow" }, "YOUR STUDENT PROFILE"),
        React.createElement("h2", { id: "profile-completeness-title" }, "Complete your student profile"),
        React.createElement("p", { className: "profile-completeness-detail" }, detail),
      ),
      React.createElement(
        "div",
        { className: "profile-completeness-progress" },
        React.createElement(
          "div",
          { className: "profile-completeness-value" },
          React.createElement("strong", null, `${percentage}%`),
          React.createElement("span", null, `${completed} of ${fields.length} details added`),
        ),
        React.createElement(
          "div",
          { className: "profile-completeness-track", role: "progressbar", "aria-label": "Profile completeness", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percentage },
          React.createElement("span", { style: { width: `${percentage}%` } }),
        ),
      ),
      React.createElement(
        "button",
        {
          className: "button button-outline profile-completeness-action",
          type: "button",
          onClick: () => window.dispatchEvent(new Event("skillmate:edit-profile")),
        },
        "Complete profile",
        React.createElement("span", { "aria-hidden": "true" }, "→"),
      ),
    );
  }

  window.renderProfileCompleteness = (profile) => {
    root.render(React.createElement(ProfileCompleteness, { profile }));
  };
})();
