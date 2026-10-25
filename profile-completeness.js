(() => {
  const container = document.querySelector("#profile-completeness-root");
  if (!window.React || !window.ReactDOM) {
    console.error("The profile completeness card could not load because React is unavailable.");
    return;
  }
  const root = ReactDOM.createRoot(container);

  function ProfileCompleteness({ profile }) {
    const fields = [
      Boolean(profile.name?.trim()),
      Boolean(profile.bio?.trim()),
      Boolean(profile.email?.trim()),
      Boolean(profile.location?.trim()),
      Boolean(profile.avatarUrl),
    ];
    const completed = fields.filter(Boolean).length;
    const percentage = Math.round((completed / fields.length) * 100);
    const missing = [
      !fields[3] && "location",
      !fields[4] && "profile photo",
      !fields[1] && "bio",
    ].filter(Boolean);
    const detail = percentage === 100
      ? "Your profile is ready to help classmates get to know you."
      : `Add your ${missing.join(" and ")} to help classmates get to know you.`;

    return React.createElement(
      "section",
      { className: "profile-completeness panel", "aria-labelledby": "profile-completeness-title" },
      React.createElement(
        "div",
        { className: "profile-completeness-copy" },
        React.createElement("p", { className: "eyebrow" }, "YOUR STUDENT PROFILE"),
        React.createElement("h2", { id: "profile-completeness-title" }, "Make a great first impression"),
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
        percentage === 100 ? "Edit profile" : "Complete profile",
        React.createElement("span", { "aria-hidden": "true" }, "→"),
      ),
    );
  }

  window.renderProfileCompleteness = (profile) => {
    root.render(React.createElement(ProfileCompleteness, { profile }));
  };
})();
