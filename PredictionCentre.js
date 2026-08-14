/**********************************************************************
 * PLTT Platform
 * PredictionCentre.js
 * Version: 0.5.0.1
 *
 * Release:
 * - Data Layer Foundation
 * - Prediction Centre consumes enriched fixture/team data
 * - Teams sheet is the single source of truth
 * - Stable Authentication Foundation
 *
 * Status:
 * Stable
 **********************************************************************/

const PREDICTION_CENTRE = {

  load() {
    const content = document.getElementById('appContent');
    if (!content) return;

    content.innerHTML = this.loadingMarkup();

    google.script.run
      .withSuccessHandler(fixtures => {
        this.render(Array.isArray(fixtures) ? fixtures : []);
      })
      .withFailureHandler(error => {
        content.innerHTML = this.errorMarkup(
          error && error.message ? error.message : 'Unable to load fixtures.'
        );
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
    const content = document.getElementById('appContent');
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
      const key = fixture.date || 'Date TBC';
      if (!groups[key]) groups[key] = [];
      groups[key].push(fixture);
    });

    const dates = Object.keys(groups);
    const gameweek = fixtures[0].gameweekID || '';

    content.innerHTML = `
      <section class="prediction-centre">
        <div class="prediction-centre-header">
          <div>
            <p class="season">GAMEWEEK ${this.escapeHtml(gameweek)}</p>
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
                ${groups[date].map(fixture => this.fixtureMarkup(fixture)).join('')}
              </div>
            </section>
          `).join('')}
        </div>
      </section>
    `;
  },

  fixtureMarkup(fixture) {
    const home = fixture.homeTeam || {};
    const away = fixture.awayTeam || {};

    const homeBadge = home.badgeURL
      ? `<img src="${this.escapeAttribute(home.badgeURL)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">H</span>`;

    const awayBadge = away.badgeURL
      ? `<img src="${this.escapeAttribute(away.badgeURL)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">A</span>`;

    return `
      <article class="prediction-fixture-card">
        <div class="fixture-meta">
          <span>${this.escapeHtml(fixture.kickoff || 'Kick-off TBC')}</span>
          <span>${this.escapeHtml(fixture.status || 'Scheduled')}</span>
        </div>

        <div class="fixture-teams">
          <div class="fixture-team home">
            <span>${this.escapeHtml(home.clubName || fixture.homeTeamID || 'Home team')}</span>
            ${homeBadge}
          </div>

          <div class="fixture-vs">VS</div>

          <div class="fixture-team away">
            ${awayBadge}
            <span>${this.escapeHtml(away.clubName || fixture.awayTeamID || 'Away team')}</span>
          </div>
        </div>
      </article>
    `;
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeAttribute(value) {
    return this.escapeHtml(value);
  }
};
