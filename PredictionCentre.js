/**********************************************************************
 * PLTT Platform
 * PredictionCentre.js
 * Version: 0.5.0
 *
 * Release:
 * - Prediction Centre Phase 1
 * - Fixture Display
 * - Stable Authentication Foundation
 **********************************************************************/

const PREDICTION_CENTRE = {

  load() {
    const content = document.getElementById("appContent");
    if (!content) return;

    content.innerHTML = this.loadingMarkup();

    google.script.run
      .withSuccessHandler(fixtures => {
        this.render(fixtures || []);
      })
      .withFailureHandler(error => {
        content.innerHTML = this.errorMarkup(error && error.message ? error.message : "Unable to load fixtures.");
      })
      .getPredictionCentreFixtures();
  },

  loadingMarkup() {
    return `
      <section class="prediction-centre">
        <article class="app-card accent">
          <p class="season">PREDICTION CENTRE</p>
          <h2>Loading fixtures…</h2>
          <p>Please wait while the current Gameweek is loaded.</p>
        </article>
      </section>
    `;
  },

  errorMarkup(message) {
    return `
      <section class="prediction-centre">
        <article class="app-card">
          <p class="season">PREDICTION CENTRE</p>
          <h2>Fixtures unavailable</h2>
          <p>${this.escapeHtml(message)}</p>
        </article>
      </section>
    `;
  },

  render(fixtures) {
    const content = document.getElementById("appContent");
    if (!content) return;

    if (!fixtures.length) {
      content.innerHTML = `
        <section class="prediction-centre">
          <article class="app-card accent">
            <p class="season">PREDICTION CENTRE</p>
            <h2>No fixtures available.</h2>
            <p>There are no fixtures published for the current Gameweek.</p>
          </article>
        </section>
      `;
      return;
    }

    const groups = {};
    fixtures.forEach(fixture => {
      const key = fixture.date || "Date TBC";
      if (!groups[key]) groups[key] = [];
      groups[key].push(fixture);
    });

    const dates = Object.keys(groups);

    content.innerHTML = `
      <section class="prediction-centre">
        <div class="prediction-centre-header">
          <div>
            <p class="season">GAMEWEEK ${this.escapeHtml(fixtures[0].gameweek)}</p>
            <h2>Prediction Centre</h2>
            <p>Fixtures for the current Gameweek.</p>
          </div>
          <div class="prediction-count">
            <strong>${fixtures.length}</strong>
            <span>Fixtures</span>
          </div>
        </div>

        <div class="prediction-fixture-groups">
          ${dates.map(date => `
            <section class="fixture-date-group">
              <div class="fixture-date-heading">${this.escapeHtml(date)}</div>
              <div class="prediction-list">
                ${groups[date].map(fixture => this.fixtureMarkup(fixture)).join("")}
              </div>
            </section>
          `).join("")}
        </div>
      </section>
    `;
  },

  fixtureMarkup(fixture) {
    const homeBadge = fixture.homeBadge
      ? `<img src="${this.escapeAttribute(fixture.homeBadge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">H</span>`;

    const awayBadge = fixture.awayBadge
      ? `<img src="${this.escapeAttribute(fixture.awayBadge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">A</span>`;

    return `
      <article class="prediction-fixture-card">
        <div class="fixture-meta">
          <span>${this.escapeHtml(fixture.time || "Kick-off TBC")}</span>
        </div>
        <div class="fixture-teams">
          <div class="fixture-team home">
            ${homeBadge}
            <span>${this.escapeHtml(fixture.homeTeam)}</span>
          </div>
          <div class="fixture-vs">VS</div>
          <div class="fixture-team away">
            <span>${this.escapeHtml(fixture.awayTeam)}</span>
            ${awayBadge}
          </div>
        </div>
      </article>
    `;
  },

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  escapeAttribute(value) {
    return this.escapeHtml(value);
  }
};
