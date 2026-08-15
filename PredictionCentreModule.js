/**********************************************************************
 * PLTT Platform
 * PredictionCentreModule.js
 * Version: 0.5.2
 *
 * Release:
 * - Prediction Entry
 * - Client-side validation
 * - Live progress counter
 * - Foundation for Save Draft
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
      .withSuccessHandler(data => {
        try {
          this.render(data || { settings: {}, fixtures: [] });
        } catch (error) {
          console.error('[PLTT PREDICTIONS] Render failed:', error);
          content.innerHTML = this.errorMarkup('Unable to display fixtures.');
        }
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
    fixtures.forEach((fixture, fixtureIndex) => {
      const key = fixture.date || 'Date TBC';
      if (!groups[key]) groups[key] = [];
      fixture._displayIndex = fixtureIndex;
      fixture.homePrediction = fixture.homePrediction == null ? '' : fixture.homePrediction;
      fixture.awayPrediction = fixture.awayPrediction == null ? '' : fixture.awayPrediction;
      groups[key].push(fixture);
    });

    const dates = Object.keys(groups);
    const gameweek = settings.currentGameweek || fixtures[0].gameweekID || '';
    const completed = this.countCompletedPredictions(fixtures);

    content.innerHTML = `
      <section class="prediction-centre">
        <div class="prediction-centre-header">
          <div>
            <p class="season">${this.escapeHtml(settings.competitionName || 'PREDICTION CENTRE')}</p>
            <h2>Prediction Centre</h2>
            <p>Gameweek ${this.escapeHtml(gameweek)}</p>
          </div>
          <div class="prediction-count">
            <strong class="prediction-completed-count">${completed} / ${fixtures.length}</strong>
            <span>Predictions completed</span>
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

    this.bindPredictionInputs(fixtures.length);
  },

  fixtureMarkup(fixture) {
    const home = fixture.home || {};
    const away = fixture.away || {};
    const index = Number(fixture._displayIndex || 0);

    const homeBadge = home.badge
      ? `<img src="${this.escapeAttribute(home.badge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">H</span>`;

    const awayBadge = away.badge
      ? `<img src="${this.escapeAttribute(away.badge)}" alt="" class="fixture-badge">`
      : `<span class="fixture-badge-placeholder">A</span>`;

    return `
      <article class="prediction-fixture-card" data-match-id="${this.escapeAttribute(fixture.matchID)}">
        <div class="fixture-meta">
          <span>${this.escapeHtml(fixture.kickOff || 'Kick-off TBC')}</span>
          <span>${this.escapeHtml(fixture.status || 'Scheduled')}</span>
        </div>

        <div class="fixture-prediction-row">
          <div class="fixture-team home">
            <span>${this.escapeHtml(home.name || 'Home team')}</span>
            ${homeBadge}
          </div>

          <div class="score-inputs">
            <input class="score-input prediction-score-input" data-prediction-index="${index}" data-prediction-side="home" data-match-id="${this.escapeAttribute(fixture.matchID)}" type="number" min="0" max="20" step="1" inputmode="numeric" autocomplete="off" aria-label="${this.escapeAttribute((home.name || 'Home team') + ' predicted goals')}" value="${this.escapeAttribute(this.normaliseScoreValue(fixture.homePrediction))}">
            <span class="score-separator">-</span>
            <input class="score-input prediction-score-input" data-prediction-index="${index}" data-prediction-side="away" data-match-id="${this.escapeAttribute(fixture.matchID)}" type="number" min="0" max="20" step="1" inputmode="numeric" autocomplete="off" aria-label="${this.escapeAttribute((away.name || 'Away team') + ' predicted goals')}" value="${this.escapeAttribute(this.normaliseScoreValue(fixture.awayPrediction))}">
          </div>

          <div class="fixture-team away">
            ${awayBadge}
            <span>${this.escapeHtml(away.name || 'Away team')}</span>
          </div>
        </div>
      </article>
    `;
  },

  bindPredictionInputs(totalFixtures) {
    const inputs = Array.from(document.querySelectorAll('.prediction-score-input'));

    inputs.forEach((input, index) => {
      if (input.dataset.plttBound === '1') return;
      input.dataset.plttBound = '1';

      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const next = inputs[index + 1];
          if (next) next.focus();
          return;
        }

        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();

        const current = this.getScoreValue(input.value);
        const nextValue = event.key === 'ArrowUp'
          ? Math.min(20, current + 1)
          : Math.max(0, current - 1);

        input.value = String(nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      input.addEventListener('input', () => {
        this.handlePredictionInput(input);
      });

      input.addEventListener('blur', () => {
        this.handlePredictionInput(input);
      });
    });

    this.updateProgress(totalFixtures);
  },

  handlePredictionInput(input) {
    const raw = String(input.value == null ? '' : input.value);
    const digits = raw.replace(/\D/g, '');

    if (raw !== digits) {
      input.value = digits;
    }

    if (digits === '') {
      input.classList.remove('prediction-input-invalid');
      input.setCustomValidity('');
    } else {
      const numeric = Number(digits);
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 20) {
        input.classList.add('prediction-input-invalid');
        input.setCustomValidity('Enter a whole number from 0 to 20.');
      } else {
        input.classList.remove('prediction-input-invalid');
        input.setCustomValidity('');
      }
    }

    const card = input.closest('.prediction-fixture-card');
    if (card) {
      const cardInputs = Array.from(card.querySelectorAll('.prediction-score-input'));
      const bothEntered = cardInputs.length === 2 && cardInputs.every(scoreInput => this.validateScore(scoreInput.value).valid);
      card.classList.toggle('prediction-complete', bothEntered);
    }

    this.updateProgress(document.querySelectorAll('.prediction-fixture-card').length);
  },

  validateScore(value) {
    const raw = String(value == null ? '' : value).trim();

    if (raw === '') {
      return { valid: false, empty: true, value: '' };
    }

    if (!/^\d+$/.test(raw)) {
      return { valid: false, empty: false, value: '' };
    }

    const numeric = Number(raw);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 20) {
      return { valid: false, empty: false, value: '' };
    }

    return { valid: true, empty: false, value: String(numeric) };
  },

  getScoreValue(value) {
    const validation = this.validateScore(value);
    return validation.valid ? Number(validation.value) : 0;
  },

  normaliseScoreValue(value) {
    const validation = this.validateScore(value);
    return validation.valid ? validation.value : '';
  },

  countCompletedPredictions(fixtures) {
    return fixtures.reduce((count, fixture) => {
      const homeValid = this.validateScore(fixture.homePrediction).valid;
      const awayValid = this.validateScore(fixture.awayPrediction).valid;
      return count + (homeValid && awayValid ? 1 : 0);
    }, 0);
  },

  updateProgress(totalFixtures) {
    const inputs = Array.from(document.querySelectorAll('.prediction-score-input'));
    const byMatch = {};

    inputs.forEach(input => {
      const matchID = input.dataset.matchId || '';
      if (!byMatch[matchID]) byMatch[matchID] = [];
      byMatch[matchID].push(input);
    });

    let completed = 0;
    Object.keys(byMatch).forEach(matchID => {
      const pair = byMatch[matchID];
      if (pair.length === 2 && pair.every(input => this.validateScore(input.value).valid)) {
        completed += 1;
      }
    });

    const counter = document.querySelector('.prediction-completed-count');
    if (counter) {
      counter.textContent = `${completed} / ${Number(totalFixtures || 0)}`;
    }
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeAttribute(value) {
    return this.escapeHtml(value);
  }
};
