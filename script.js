'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputElevation = document.querySelector('.form__input--elevation');
const locationMessage = document.querySelector('#location-message');
const mapInstruction = document.querySelector('#map-instruction');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #activeWorkoutId = null;
  #markers = {};
  #previewMarker = null;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach form submit
    form.addEventListener('submit', this._newWorkout.bind(this));

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    [inputDistance, inputDuration, inputElevation].forEach(input =>
      input.addEventListener('input', () =>
        input.classList.remove('form__input--error'),
      ),
    );

    document.addEventListener('click', e => {
      const clickedInsideWorkout = e.target.closest('.workout');
      const clickedInsideForm = e.target.closest('.form');

      if (!clickedInsideWorkout && !clickedInsideForm) {
        this._clearSelection();
      }
    });
  }

  _getPosition() {
    if (!navigator.geolocation) {
      locationMessage.classList.remove('hidden');
      return;
    }

    navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
      // user denied or error
      locationMessage.classList.remove('hidden');
      mapInstruction.classList.add('hidden');
    });
  }

  _loadMap(position) {
    locationMessage?.classList.add('hidden');
    mapInstruction?.classList.remove('hidden');
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', mapE => {
      const { lat, lng } = mapE.latlng;

      if (this.#previewMarker) {
        this.#previewMarker.setLatLng([lat, lng]);
      } else {
        this.#previewMarker = L.marker([lat, lng], {
          opacity: 0.5,
        }).addTo(this.#map);
      }

      this._showForm(mapE);

      mapInstruction?.classList.add('hidden');
    });

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
    this.#map.on('click', () => {
      this._clearSelection();
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    mapInstruction?.classList.remove('hidden');
  }

  _clearSelection() {
    document
      .querySelectorAll('.workout')
      .forEach(el => el.classList.remove('workout--active'));

    this.#activeWorkoutId = null;
  }

  _newWorkout(e) {
    e.preventDefault();

    const type = inputType.value;
    const distanceVal = inputDistance.value;
    const durationVal = inputDuration.value;
    const elevationVal = inputElevation.value;
    const distance = +distanceVal;
    const duration = +durationVal;
    const elevation = +elevationVal;
    const errmessage = document.querySelector('.form__error');

    // ukloni stare obrube
    [inputDistance, inputDuration, inputElevation].forEach(input =>
      input.classList.remove('form__input--error'),
    );

    // 1️⃣ Provjera ne-broj ili negativni / nula
    const invalidInputs = [];
    if (distanceVal !== '' && (!Number.isFinite(distance) || distance <= 0))
      invalidInputs.push(inputDistance);
    if (durationVal !== '' && (!Number.isFinite(duration) || duration <= 0))
      invalidInputs.push(inputDuration);
    if (elevationVal !== '' && (!Number.isFinite(elevation) || elevation < 0))
      invalidInputs.push(inputElevation);

    if (invalidInputs.length > 0) {
      errmessage.classList.remove('hidden');
      errmessage.textContent = 'Please enter positive numbers only! ❌';
      invalidInputs.forEach(inp => inp.classList.add('form__input--error'));
      return;
    }

    const emptyInputs = [];
    if (distanceVal === '') emptyInputs.push(inputDistance);
    if (durationVal === '') emptyInputs.push(inputDuration);
    if (elevationVal === '') emptyInputs.push(inputElevation);

    if (emptyInputs.length > 0) {
      errmessage.classList.remove('hidden');
      errmessage.textContent = 'Please fill in all fields! ⚠️';
      emptyInputs.forEach(inp => inp.classList.add('form__input--error'));
      return;
    }

    if (!this.#mapEvent) {
      alert('Please click on the map to select workout location');
      return;
    }

    errmessage.classList.add('hidden');
    [inputDistance, inputDuration, inputElevation].forEach(input =>
      input.classList.remove('form__input--error'),
    );

    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      workout = new Running([lat, lng], distance, duration, elevation);
    }

    if (type === 'cycling') {
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);

    if (this.#previewMarker) {
      this.#map.removeLayer(this.#previewMarker);
      this.#previewMarker = null;
    }

    this._hideForm();
    this._setLocalStorage();
  }

  _checkInputs() {
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const elevation = +inputElevation.value;

    return (
      Number.isFinite(distance) &&
      distance > 0 &&
      Number.isFinite(duration) &&
      duration > 0 &&
      Number.isFinite(elevation)
    );
  }

  _clearSelection() {
    document
      .querySelectorAll('.workout')
      .forEach(el => el.classList.remove('workout--active'));
  }

  _selectWorkout(id) {
    document
      .querySelectorAll('.workout')
      .forEach(el => el.classList.remove('workout--active'));

    const el = document.querySelector(`.workout[data-id="${id}"]`);
    if (!el) return;

    el.classList.add('workout--active');
    this.#activeWorkoutId = id;
  }

  _deleteWorkout(id) {
    document.querySelector(`.workout[data-id="${id}"]`)?.remove();

    this.#map.removeLayer(this.#markers[id]);
    delete this.#markers[id];

    this.#workouts = this.#workouts.filter(w => w.id !== id);

    this._setLocalStorage();

    this.#activeWorkoutId = null;
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        }),
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`,
      );

    this.#markers[workout.id] = marker;
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <div class="workout__header">
        <h2 class="workout__title">${workout.description}</h2>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
  `;

    if (workout.type === 'running') {
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
  `;
    }

    if (workout.type === 'cycling') {
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    `;
    }

    html += `
    <div class="workout__actions">
      <button class="workout__delete" title="Delete workout">Delete Workout</button>

    </div>
  </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const id = workoutEl.dataset.id;

    // DELETE
    if (e.target.classList.contains('workout__delete')) {
      this._deleteWorkout(id);
      return;
    }

    // SELECT
    this._selectWorkout(id);

    const workout = this.#workouts.find(w => w.id === id);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    this.#markers[id]?.openPopup();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
