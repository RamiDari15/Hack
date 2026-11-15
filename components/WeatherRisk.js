import ActionForm from '@/components/forms/ActionForm';
import { checkWeather } from '@/app/actions/planning';
import { formatDate } from '@/lib/format';

const RISK = { low: { label: 'Low weather risk', tone: 'badge-ok' }, medium: { label: 'Some weather risk', tone: 'badge-warn' }, high: { label: 'High weather risk', tone: 'badge-warn' } };

// Weather history for the event's date and place, from NASA POWER. History, not a forecast.
export default function WeatherRisk({ event, weather, isOwner }) {
  const w = weather?.summary;
  const stale = weather && weather.event_date !== event.event_date;
  return (
    <section className="panel stack weather" aria-labelledby="wx-h">
      <div className="panel-head">
        <h2 id="wx-h">Weather risk</h2>
        <span className="fine">Data: NASA POWER</span>
      </div>
      {w && !stale ? (
        <>
          <div className="row"><span className={`badge ${RISK[w.risk]?.tone ?? 'badge-plain'}`}>{RISK[w.risk]?.label}</span></div>
          <dl className="wx-grid">
            <div><dt>Rain on {formatDate(event.event_date)?.replace(/, \d{4}$/, '')}</dt><dd className="num">{w.rain_on_date_years} of {w.date_years} years</dd></div>
            <div><dt>Rainy days nearby</dt><dd className="num">{w.rainy_pct}%</dd></div>
            <div><dt>Typical high / low</dt><dd className="num">{w.avg_high_f}° / {w.avg_low_f}°F</dd></div>
            <div><dt>Very hot days</dt><dd className="num">{w.hot_pct}%</dd></div>
          </dl>
          <ul className="small">{w.advice.map((a) => <li key={a}>{a}</li>)}</ul>
          <p className="fine">NASA POWER daily records, {w.years}, {w.window_days} days either side of the date, at {weather.place_note} ({weather.latitude.toFixed(2)}, {weather.longitude.toFixed(2)}). This is history, not a forecast.</p>
        </>
      ) : (
        <p className="small muted">{stale ? 'The event date changed. Check again for the new date.' : 'See how often it rained, got hot or windy around your date over the last 20 years, from NASA satellite and model records.'}</p>
      )}
      {isOwner && (
        <ActionForm action={checkWeather}>
          <input type="hidden" name="event_id" value={event.id} />
          <div className="row"><button className="btn btn-sm btn-outline" type="submit">{w ? 'Check again' : 'Check weather history'}</button></div>
        </ActionForm>
      )}
    </section>
  );
}
