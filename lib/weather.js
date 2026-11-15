import 'server-only';

// Weather history for an event's date and place from NASA POWER (Prediction Of Worldwide Energy
// Resources), daily point data. This is history, not a forecast: it says how often it rained or
// got hot around this date over the last 20 years at this location.
// https://power.larc.nasa.gov/docs/services/api/temporal/daily/

const PARAMS = ['PRECTOTCORR', 'T2M_MAX', 'T2M_MIN', 'WS2M'];
const WINDOW_DAYS = 3;
export const NASA_SOURCE = 'NASA POWER daily point data (MERRA-2 and GEOS), Prediction Of Worldwide Energy Resources project, NASA Langley Research Center';

const base = () => (process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov').replace(/\/$/, '');
const toF = (c) => Math.round(c * 9 / 5 + 32);

export function yearsBack(today = new Date()) {
  const last = today.getUTCFullYear() - 1;
  return { first: last - 19, last };
}

export async function fetchNasaHistory({ latitude, longitude, eventDate }) {
  const { first, last } = yearsBack();
  const url = `${base()}/api/temporal/daily/point?parameters=${PARAMS.join(',')}&community=RE&longitude=${longitude.toFixed(4)}&latitude=${latitude.toFixed(4)}&start=${first}0101&end=${last}1231&format=JSON&time-standard=LST`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`);
  const json = await res.json();
  const p = json?.properties?.parameter;
  if (!p || !p.PRECTOTCORR) throw new Error('NASA POWER returned no daily data for this place');
  return summarize(p, eventDate, first, last, json?.header?.fill_value ?? -999);
}

// Pure: turns NASA POWER daily series into the numbers the page shows.
export function summarize(p, eventDate, first, last, fill = -999) {
  const [, mm, dd] = eventDate.split('-').map(Number);
  const ok = (v) => typeof v === 'number' && v !== fill && v > -900;
  let days = 0; let rainy = 0; let heavy = 0; let hot = 0; let cold = 0; let windy = 0; let hiSum = 0; let loSum = 0; let tempDays = 0;
  let rainOnDate = 0; let dateYears = 0;
  for (let y = first; y <= last; y++) {
    const center = Date.UTC(y, mm - 1, dd);
    for (let k = -WINDOW_DAYS; k <= WINDOW_DAYS; k++) {
      const d = new Date(center + k * 86400000);
      const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      const rain = p.PRECTOTCORR?.[key]; const hi = p.T2M_MAX?.[key]; const lo = p.T2M_MIN?.[key]; const wind = p.WS2M?.[key];
      if (ok(rain)) {
        days += 1;
        if (rain >= 1) rainy += 1;
        if (rain >= 10) heavy += 1;
        if (k === 0) { dateYears += 1; if (rain >= 1) rainOnDate += 1; }
      }
      if (ok(hi) && ok(lo)) { tempDays += 1; hiSum += hi; loSum += lo; if (hi >= 32) hot += 1; if (lo <= 5) cold += 1; }
      if (ok(wind) && wind >= 8) windy += 1;
    }
  }
  if (!days) throw new Error('NASA POWER had no usable days around this date');
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const s = {
    years: `${first}–${last}`, window_days: WINDOW_DAYS, days,
    rain_on_date_years: rainOnDate, date_years: dateYears,
    rainy_pct: pct(rainy, days), heavy_rain_pct: pct(heavy, days),
    avg_high_f: tempDays ? toF(hiSum / tempDays) : null, avg_low_f: tempDays ? toF(loSum / tempDays) : null,
    hot_pct: pct(hot, tempDays), cold_night_pct: pct(cold, tempDays), windy_pct: pct(windy, days),
  };
  s.risk = s.rainy_pct >= 40 || s.heavy_rain_pct >= 10 || s.hot_pct >= 30 ? 'high' : s.rainy_pct >= 25 || s.hot_pct >= 15 || s.windy_pct >= 20 ? 'medium' : 'low';
  s.advice = [
    s.rainy_pct >= 25 && `Rain fell on ${s.rainy_pct}% of days around this date. Hold a tent or an indoor backup, and ask venues about rain plans.`,
    s.heavy_rain_pct >= 5 && `Heavy rain (10 mm or more) on ${s.heavy_rain_pct}% of days. Check drainage and covered walkways.`,
    s.hot_pct >= 15 && `Highs reached 90°F or more on ${s.hot_pct}% of days. Plan shade, water and a later start.`,
    s.cold_night_pct >= 20 && `Nights dropped to 41°F or below on ${s.cold_night_pct}% of days. Plan heaters or a cover for evening parts.`,
    s.windy_pct >= 20 && `Wind of 18 mph or more on ${s.windy_pct}% of days. Weigh down decor and check tent ratings.`,
  ].filter(Boolean);
  if (!s.advice.length) s.advice = ['Historically calm around this date. Still check the forecast the week before.'];
  return s;
}
