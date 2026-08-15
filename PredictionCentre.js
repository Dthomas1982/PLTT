/**********************************************************************
 * PLTT Platform
 * PredictionCentreModule.js
 * Version: 0.5.1.1
 *
 * Release:
 * - Apps Script file naming compatibility
 * - Prediction Centre foundation preserved
 * - No authentication changes
 **********************************************************************/

const PREDICTION_CENTRE = {

  load() {
    const content = document.getElementById('appContent');
    if (!content) return;

    content.innerHTML = this.loadingMarkup();

    google.script.run
      .withSuccessHandler(data => {
        this.render(data || { settings: {}, fixtures: [] });
      })
      .withFailureHandler(error => {
        content.innerHTML = this.errorMarkup(
          error && error.message ? error.message : 'Unable to load fixtures.'
        );
      })
      .getPredictionCentreData();
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

  render(data) {
    const content = document.getElementById('appContent');
    if (!content) return;

    const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
    const settings = data.settings || {};

    if (!fixtures.length) {
      content.innerHTML = `
        <section class="prediction-centre">
          <article class="app-card accent">
            <p class="season">${this.escapeHtml(settings.competitionName || 'PREDICTION CENTRE')}</p>
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
    const gameweek = settings.currentGameweek || fixtures[0].gameweekID || '';

    content.innerHTML = `
      <section class="prediction-centre">
        <div class="prediction-centre-header">
          <div>
            <p class="season">${this.escapeHtml(settings.competitionName || 'PREDICTION CENTRE')}</p>
            <h2>Prediction Centre</h2>
            <p>Gameweek ${this.escapeHtml(gameweek)}</p>
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
    const home = fixture.home || {};
    const away = fixture.away || {};

    const homeBadge = home.badge
      ? `<img src="${this.escapeAttribute(home.badge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">H</span>`;

    const awayBadge = away.badge
      ? `<img src="${this.escapeAttribute(away.badge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">A</span>`;

    return `
      <article class="prediction-fixture-card">
        <div class="fixture-meta">
          <span>${this.escapeHtml(fixture.kickOff || 'Kick-off TBC')}</span>
          <span>${this.escapeHtml(fixture.status || 'Scheduled')}</span>
        </div>

        <div class="fixture-teams">
          <div class="fixture-team home">
            <span>${this.escapeHtml(home.name || 'Home team')}</span>
            ${homeBadge}
          </div>

          <div class="fixture-vs">VS</div>

          <div class="fixture-team away">
            ${awayBadge}
            <span>${this.escapeHtml(away.name || 'Away team')}</span>
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
