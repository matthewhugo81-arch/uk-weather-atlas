'use strict';
globalThis.WeatherHistory = {
  frame(bundle, hoursBack = 0) {
    if (!bundle || ![0, 1, 2, 3].includes(hoursBack)) return null;
    if (!hoursBack) return bundle;
    const frame = bundle.history?.find(frame => frame.hoursBack === hoursBack);
    return Number.isFinite(frame?.asOf) && Array.isArray(frame.stations)
      ? {...bundle, ...frame} : null;
  },
  time(bundle, hoursBack, now = Date.now() / 1000) {
    return hoursBack ? this.frame(bundle, hoursBack)?.asOf ?? null : now;
  }
};
